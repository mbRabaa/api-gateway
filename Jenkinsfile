pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'mbrabaa2023/api-gateway'
        DOCKER_TAG = "${env.BUILD_ID}"
        CONTAINER_NAME = 'api-gateway-container'
        HOST_PORT = '8000'
        CONTAINER_PORT = '8000'
    }

    stages {
        // Étape 1: Récupération du code source
        stage('Checkout') {
            steps { 
                checkout scm 
                // Archive le code source pour référence (optionnel)
                archiveArtifacts artifacts: '**/*.js,**/*.json', excludes: 'node_modules/**', fingerprint: true
            }
        }

        // Étape 2: Installation des dépendances
        stage('Install Dependencies') {
            steps {
                sh 'npm install'
                // Archive le fichier package-lock.json pour reproductibilité
                archiveArtifacts artifacts: 'package-lock.json', fingerprint: true
            }
        }

        // Étape 3: Construction de l'application
        stage('Build') {
            steps {
                sh 'npm run build'
                // Archive les fichiers compilés dans le dossier dist/
                archiveArtifacts artifacts: 'dist/**/*', fingerprint: true
            }
        }

        // Étape 4: Exécution des tests
        stage('Test') {
            steps {
                sh 'npm test'
                // Archive les rapports de tests au format JUnit
                junit '**/test-results/*.xml' 
                // Publie le rapport de couverture de code
                publishHTML target: [
                    reportDir: 'coverage/lcov-report',
                    reportFiles: 'index.html',
                    reportName: 'Code Coverage Report',
                    keepAll: true
                ]
            }
        }

        // Étape 5: Construction de l'image Docker
        stage('Build Docker Image') {
            steps {
                script {
                    sh 'docker --version'
                    docker.build("${env.DOCKER_IMAGE}:${env.DOCKER_TAG}")
                    // Archive le Dockerfile et les fichiers de configuration associés
                    archiveArtifacts artifacts: 'Dockerfile,docker-compose*.yml', fingerprint: true
                }
            }
        }

        // Étape 6: Push vers Docker Hub
        stage('Push to Docker Hub') {
            steps {
                script {
                    withCredentials([usernamePassword(
                        credentialsId: 'docker-hub-creds',
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

        // Étape 7: Déploiement
        stage('Deploy') {
            steps {
                script {
                    sh "docker stop ${env.CONTAINER_NAME} || true"
                    sh "docker rm ${env.CONTAINER_NAME} || true"
                    sh """
                        docker run -d \
                          --name ${env.CONTAINER_NAME} \
                          -p ${env.HOST_PORT}:${env.CONTAINER_PORT} \
                          -e PORT=${env.CONTAINER_PORT} \
                          --restart unless-stopped \
                          ${env.DOCKER_IMAGE}:${env.DOCKER_TAG}
                    """
                    // Capture les logs du conteneur pour archivage
                    sh "docker logs ${env.CONTAINER_NAME} > container.log 2>&1 || true"
                    archiveArtifacts artifacts: 'container.log', fingerprint: true
                }
            }
        }
    }

    post {
        always {
            echo "Build terminé - Statut: ${currentBuild.currentResult}"
            sh 'docker logout || true'
            sh 'docker image prune -f || true'
            
            // Archive supplémentaire des fichiers importants
            archiveArtifacts artifacts: 'server.js,config/*.json', fingerprint: true
            
            // Sauvegarde la liste des dépendances installées
            sh 'npm list --depth=0 > dependencies.txt'
            archiveArtifacts artifacts: 'dependencies.txt'
        }
        
        success {
            // Notification en cas de succès
            emailext body: """
                Build ${BUILD_NUMBER} réussi!
                Artifacts disponibles: ${BUILD_URL}artifact/
                Image Docker: ${env.DOCKER_IMAGE}:${env.DOCKER_TAG}
                Conteneur: ${env.CONTAINER_NAME} sur le port ${env.HOST_PORT}
            """, 
            subject: 'SUCCÈS: Déploiement API Gateway',
            to: 'votre-email@example.com'
        }
        
        failure {
            // Notification en cas d'échec
            emailext body: """
                Build ${BUILD_NUMBER} a échoué!
                Consultez les logs: ${BUILD_URL}console
                Derniers logs conteneur: ${BUILD_URL}artifact/container.log
            """, 
            subject: 'ÉCHEC: Déploiement API Gateway',
            to: elmbarkirbea@gmail.com
        }
    }
}