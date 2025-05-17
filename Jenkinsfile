pipeline {
    agent any

    environment {
        // Configuration Docker
        DOCKER_IMAGE = 'mbrabaa2023/api-gateway'
        DOCKER_TAG = "${env.BUILD_ID}"  // Utilise l'ID de build comme tag
        CONTAINER_NAME = 'api-gateway-container'
        
        // Configuration des ports
        HOST_PORT = '8000'      // Port exposé sur la machine hôte
        CONTAINER_PORT = '8000' // Port interne du conteneur (doit matcher server.js)
        
        // URLs par défaut pour les services (avec fallback)
        FRONTEND_URL = 'http://localhost:8080'
        PAIEMENT_SERVICE_URL = 'http://localhost:3002'
        RESERVATION_SERVICE_URL = 'http://localhost:3004'
    }

    stages {
        // Étape 1: Récupération du code source
        stage('Checkout') {
            steps { 
                checkout scm  // Clone le dépôt Git
            }
        }

        // Étape 2: Installation des dépendances Node.js
        stage('Install Dependencies') {
            steps {
                sh 'npm install'  // Installe les packages npm
            }
        }

        // Étape 3: Construction du projet (si nécessaire)
        stage('Build') {
            steps {
                sh 'npm run build'  // Exécute le script build (si configuré)
            }
        }

        // Étape 4: Exécution des tests
        stage('Test') {
            steps {
                sh 'npm test'  // Lance les tests unitaires/intégration
            }
        }

        // Étape 5: Construction de l'image Docker
        stage('Build Docker Image') {
            steps {
                script {
                    sh 'docker --version'  // Vérifie la version Docker
                    docker.build("${env.DOCKER_IMAGE}:${env.DOCKER_TAG}")
                }
            }
        }

        // Étape 6: Publication sur Docker Hub
        stage('Push to Docker Hub') {
            steps {
                script {
                    withCredentials([usernamePassword(
                        credentialsId: 'docker-hub-creds',  // Identifiants stockés dans Jenkins
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )]) {
                        sh """
                            echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                            docker push ${env.DOCKER_IMAGE}:${env.DOCKER_TAG}
                            docker tag ${env.DOCKER_IMAGE}:${env.DOCKER_TAG} ${env.DOCKER_IMAGE}:latest
                            docker push ${env.DOCKER_IMAGE}:latest
                        """
                    }
                }
            }
        }

        // Étape 7: Déploiement du conteneur
        stage('Deploy') {
            steps {
                script {
                    // Nettoyage des anciens conteneurs
                    sh "docker stop ${env.CONTAINER_NAME} || true"  // Force le succès même si le conteneur n'existe pas
                    sh "docker rm ${env.CONTAINER_NAME} || true"
                    
                    // Lancement du nouveau conteneur avec les variables d'environnement
                    sh """
                        docker run -d \
                          --name ${env.CONTAINER_NAME} \
                          -p ${env.HOST_PORT}:${env.CONTAINER_PORT} \
                          -e PORT=${env.CONTAINER_PORT} \
                          -e FRONTEND_URL=${env.FRONTEND_URL} \
                          -e PAIEMENT_SERVICE_URL=${env.PAIEMENT_SERVICE_URL} \
                          -e RESERVATION_SERVICE_URL=${env.RESERVATION_SERVICE_URL} \
                          -e TRAJET_SERVICE_URL=${env.RESERVATION_SERVICE_URL} \\  // Utilise le même URL que RESERVATION
                          --restart unless-stopped \  // Redémarrage automatique
                          ${env.DOCKER_IMAGE}:${env.DOCKER_TAG}
                    """
                    
                    // Vérifications post-déploiement
                    sh "docker ps -a | grep ${env.CONTAINER_NAME}"  // Vérifie l'état
                    sh "curl -I http://localhost:${env.HOST_PORT}/health || true"  // Test de santé
                }
            }
        }
    }

    // Actions finales
    post {
        always {
            echo "Build terminé - Statut: ${currentBuild.currentResult}"
            sh 'docker logout || true'  // Nettoyage des credentials
            
            // Nettoyage des images intermédiaires (optionnel)
            sh 'docker image prune -f || true'
        }
    }
}