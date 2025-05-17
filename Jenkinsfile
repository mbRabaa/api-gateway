pipeline {
    agent any

    environment {
        // Configuration Docker
        DOCKER_IMAGE = 'mbrabaa2023/api-gateway'
        DOCKER_TAG = "${env.BUILD_ID}"
        CONTAINER_NAME = 'api-gateway-container'
        
        // Configuration des ports
        HOST_PORT = '8000'
        CONTAINER_PORT = '8000'
        
        // URLs par défaut pour les services
        FRONTEND_URL = 'http://localhost:8080'
        PAIEMENT_SERVICE_URL = 'http://localhost:3002'
        RESERVATION_SERVICE_URL = 'http://localhost:3004'
    }

    stages {
        stage('Checkout') {
            steps { 
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    sh 'docker --version'
                    docker.build("${env.DOCKER_IMAGE}:${env.DOCKER_TAG}")
                }
            }
        }

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

        stage('Deploy') {
            steps {
                script {
                    // Nettoyage des anciens conteneurs
                    sh "docker stop ${env.CONTAINER_NAME} || true"
                    sh "docker rm ${env.CONTAINER_NAME} || true"
                    
                    // Lancement du nouveau conteneur (format corrigé)
                    sh """docker run -d \
                          --name ${env.CONTAINER_NAME} \
                          -p ${env.HOST_PORT}:${env.CONTAINER_PORT} \
                          -e PORT=${env.CONTAINER_PORT} \
                          -e FRONTEND_URL=${env.FRONTEND_URL} \
                          -e PAIEMENT_SERVICE_URL=${env.PAIEMENT_SERVICE_URL} \
                          -e RESERVATION_SERVICE_URL=${env.RESERVATION_SERVICE_URL} \
                          -e TRAJET_SERVICE_URL=${env.RESERVATION_SERVICE_URL} \
                          --restart unless-stopped \
                          ${env.DOCKER_IMAGE}:${env.DOCKER_TAG}"""
                    
                    // Vérifications
                    sh "docker ps -a | grep ${env.CONTAINER_NAME}"
                    sh "curl -I http://localhost:${env.HOST_PORT}/health || true"
                }
            }
        }
    }

    post {
        always {
            echo "Build terminé - Statut: ${currentBuild.currentResult}"
            sh 'docker logout || true'
            sh 'docker image prune -f || true'
        }
    }
}