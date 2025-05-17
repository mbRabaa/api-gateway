pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'mbrabaa2023/api-gateway'
        DOCKER_TAG = "${env.BUILD_NUMBER}"
        CONTAINER_NAME = 'api-gateway-container'
        HOST_PORT = '8000'
        CONTAINER_PORT = '8000'
        FRONTEND_URL = 'http://localhost:8080'
        PAIEMENT_SERVICE_URL = 'http://localhost:3002'
        RESERVATION_SERVICE_URL = 'http://localhost:3004'
        TRAJET_SERVICE_URL = 'http://localhost:3005'
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
                rm -rf node_modules package-lock.json
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                npm install --legacy-peer-deps
                npm install jest-junit@latest --save-dev
                '''
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Test') {
            steps {
                sh '''
                npm test || true
                '''
            }
            post {
                always {
                    junit 'junit.xml'
                    archiveArtifacts artifacts: 'coverage/**/*'
                }
            }
        }

        stage('Build Docker Image') {
            when {
                expression { currentBuild.resultIsBetterOrEqualTo('UNSTABLE') }
            }
            steps {
                script {
                    docker.build("${env.DOCKER_IMAGE}:${env.DOCKER_TAG}")
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
                        echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                        docker push ${env.DOCKER_IMAGE}:${env.DOCKER_TAG}
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
                    docker run -d \
                        --name ${env.CONTAINER_NAME} \
                        -p ${env.HOST_PORT}:${env.CONTAINER_PORT} \
                        -e PORT=${env.CONTAINER_PORT} \
                        -e FRONTEND_URL=${env.FRONTEND_URL} \
                        -e PAIEMENT_SERVICE_URL=${env.PAIEMENT_SERVICE_URL} \
                        -e RESERVATION_SERVICE_URL=${env.RESERVATION_SERVICE_URL} \
                        -e TRAJET_SERVICE_URL=${env.TRAJET_SERVICE_URL} \
                        --restart unless-stopped \
                        ${env.DOCKER_IMAGE}:${env.DOCKER_TAG}
                    """
                }
            }
        }
    }

    post {
        always {
            echo "Build status: ${currentBuild.currentResult}"
            cleanWs()
        }
    }
}