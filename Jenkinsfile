pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'mbrabaa2023/api-gateway'
        DOCKER_TAG = "${env.BUILD_ID}"
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
                    // Solution recommandée: Utilisez docker.withRegistry()
                    docker.withRegistry('https://registry.hub.docker.com', 'docker-hub-credentials') {
                        docker.build("${env.DOCKER_IMAGE}:${env.DOCKER_TAG}")
                    }
                }
            }
        }

        stage('Push to Docker Hub') {
            steps {
                script {
                    docker.withRegistry('https://registry.hub.docker.com', 'docker-hub-credentials') {
                        // Pousse l'image avec le tag BUILD_ID
                        docker.image("${env.DOCKER_IMAGE}:${env.DOCKER_TAG}").push()
                        
                        // Optionnel: Tag et pousse aussi en tant que 'latest'
                        docker.image("${env.DOCKER_IMAGE}:${env.DOCKER_TAG}").push('latest')
                    }
                }
            }
        }
    }

    post {
        always {
            echo "Build terminé - Statut: ${currentBuild.currentResult}"
        }
    }
}