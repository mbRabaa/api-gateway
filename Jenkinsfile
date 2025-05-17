pipeline {
    agent any

    environment {
        // Configuration Docker
        DOCKER_IMAGE = 'mbrabaa2023/api-gateway'
        DOCKER_TAG = "${env.BUILD_NUMBER}"
        CONTAINER_NAME = 'api-gateway-container'
        
        // Configuration des ports
        HOST_PORT = '8000'
        CONTAINER_PORT = '8000'
        
        // URLs des services
        FRONTEND_URL = 'http://localhost:8080'
        PAIEMENT_SERVICE_URL = 'http://localhost:3002'
        RESERVATION_SERVICE_URL = 'http://localhost:3004'
        TRAJET_SERVICE_URL = 'http://localhost:3005'
        
        // Configuration Node
        NODE_ENV = 'production'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh 'git rev-parse HEAD > .git/commit-id'
            }
        }

        stage('Clean Workspace') {
            steps {
                sh '''
                echo "Nettoyage du workspace..."
                rm -rf node_modules package-lock.json
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                echo "Installation des dépendances..."
                npm install --legacy-peer-deps
                npm install jest-junit@latest --save-dev
                '''
            }
        }

        stage('Build') {
            steps {
                sh '''
                echo "Build de l'application..."
                npm run build
                '''
            }
        }

        stage('Test') {
            steps {
                sh '''
                echo "Exécution des tests..."
                npm test || true
                
                # Fallback si aucun test n'est exécuté
                if [ ! -f junit.xml ]; then
                    echo "Création d'un fichier junit.xml vide..."
                    echo '<?xml version="1.0" encoding="UTF-8"?><testsuites></testsuites>' > junit.xml
                fi
                '''
            }
            post {
                always {
                    junit 'junit.xml'
                    archiveArtifacts artifacts: 'coverage/**/*,junit.xml'
                }
            }
        }

        stage('Build Docker Image') {
            when {
                expression { currentBuild.resultIsBetterOrEqualTo('UNSTABLE') }
            }
            steps {
                script {
                    docker.build("${env.DOCKER_IMAGE}:${env.DOCKER_TAG}", "--build-arg NODE_ENV=${env.NODE_ENV} .")
                }
            }
        }

        stage('Push to Docker Hub') {
            when {
                expression { currentBuild.resultIsBetterOrEqualTo('UNSTABLE') }
            }
            steps {
                script {
                    withCredentials([usernamePassword(
                        credentialsId: 'docker-hub-creds',
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )]) {
                        sh """
                        echo "${DOCKER_PASS}" | docker login -u "${DOCKER_USER}" --password-stdin
                        docker push ${env.DOCKER_IMAGE}:${env.DOCKER_TAG}
                        docker tag ${env.DOCKER_IMAGE}:${env.DOCKER_TAG} ${env.DOCKER_IMAGE}:latest
                        docker push ${env.DOCKER_IMAGE}:latest
                        """
                    }
                }
            }
        }

        stage('Deploy') {
            when {
                expression { currentBuild.resultIsBetterOrEqualTo('UNSTABLE') }
            }
            steps {
                script {
                    sh """
                    docker stop ${env.CONTAINER_NAME} || true
                    docker rm ${env.CONTAINER_NAME} || true
                    
                    docker run -d \\
                        --name ${env.CONTAINER_NAME} \\
                        -p ${env.HOST_PORT}:${env.CONTAINER_PORT} \\
                        -e PORT=${env.CONTAINER_PORT} \\
                        -e FRONTEND_URL=${env.FRONTEND_URL} \\
                        -e PAIEMENT_SERVICE_URL=${env.PAIEMENT_SERVICE_URL} \\
                        -e RESERVATION_SERVICE_URL=${env.RESERVATION_SERVICE_URL} \\
                        -e TRAJET_SERVICE_URL=${env.TRAJET_SERVICE_URL} \\
                        --restart unless-stopped \\
                        ${env.DOCKER_IMAGE}:${env.DOCKER_TAG}
                    """
                    
                    // Vérification du déploiement
                    sh """
                    echo "Vérification du conteneur..."
                    sleep 15
                    docker ps -a | grep ${env.CONTAINER_NAME}
                    curl -I http://localhost:${env.HOST_PORT}/health || true
                    """
                }
            }
        }
    }

    post {
        always {
            echo "Pipeline terminé - Statut: ${currentBuild.currentResult}"
            script {
                def commitId = readFile('.git/commit-id').trim()
                currentBuild.description = "Build #${env.BUILD_NUMBER} (${commitId.take(7)})"
            }
            cleanWs()
        }
        success {
            echo "✅ Build réussi!"
        }
        failure {
            echo "❌ Build échoué!"
        }
    }
}