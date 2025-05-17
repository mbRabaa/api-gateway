pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'mbrabaa2023/api-gateway'
        DOCKER_TAG = "${env.BUILD_ID}"
        CONTAINER_NAME = 'api-gateway-container'
        HOST_PORT = '8000'  // Port exposé sur l'hôte
        CONTAINER_PORT = '8000'  // Port du conteneur
    }

    stages {
        stage('Checkout') {
            steps { checkout scm }
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
                    // Arrête et supprime l'ancien conteneur s'il existe
                    sh "docker stop ${env.CONTAINER_NAME} || true"
                    sh "docker rm ${env.CONTAINER_NAME} || true"
                    
                    // Crée et démarre un nouveau conteneur
                    sh """
                        docker run -d \
                          --name ${env.CONTAINER_NAME} \
                          -p ${env.HOST_PORT}:${env.CONTAINER_PORT} \
                          -e PORT=${env.CONTAINER_PORT} \
                          --restart unless-stopped \
                          ${env.DOCKER_IMAGE}:${env.DOCKER_TAG}
                    """
                    
                    // Vérification que le conteneur est bien démarré
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
            
            // Nettoyage optionnel des images intermédiaires
            sh 'docker image prune -f || true'
        }
    }
}