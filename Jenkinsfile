pipeline {
    agent any

    environment {
        // Docker Configuration
        DOCKER_IMAGE = 'mbrabaa2023/api-gateway'
        DOCKER_TAG = "${env.BUILD_NUMBER}"
        CONTAINER_NAME = 'api-gateway-container'
        
        // Port Configuration
        HOST_PORT = '8000'
        CONTAINER_PORT = '8000'
        
        // Service URLs
        FRONTEND_URL = 'http://localhost:8080'
        PAIEMENT_SERVICE_URL = 'http://localhost:3002'
        RESERVATION_SERVICE_URL = 'http://localhost:3004'
        TRAJET_SERVICE_URL = 'http://localhost:3005'
        
        // Node Environment
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
                echo "Cleaning workspace..."
                rm -rf node_modules package-lock.json
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                echo "Installing dependencies..."
                npm install --legacy-peer-deps
                npm install jest-junit@latest --save-dev
                npm list
                '''
            }
        }

        stage('Build') {
            steps {
                sh '''
                echo "Building application..."
                npm run build
                '''
            }
        }

        stage('Test') {
            steps {
                sh '''
                echo "Running tests..."
                npm test || true
                '''
            }
            post {
                always {
                    junit 'reports/junit.xml'
                    archiveArtifacts artifacts: 'coverage/**/*,reports/junit.xml'
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
                    """
                    
                    sh """
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
                    
                    sh """
                    echo "Container status:"
                    docker ps -a | grep ${env.CONTAINER_NAME}
                    echo "Waiting for service to start..."
                    sleep 15
                    echo "Health check:"
                    curl -I http://localhost:${env.HOST_PORT}/health || true
                    """
                }
            }
        }
    }

    post {
        always {
            echo "Pipeline completed - Status: ${currentBuild.currentResult}"
            script {
                def commitId = readFile('.git/commit-id').trim()
                currentBuild.description = "Build #${env.BUILD_NUMBER} (${commitId.take(7)})"
            }
            cleanWs()
        }
        success {
            echo "Build succeeded!"
        }
        failure {
            echo "Build failed!"
        }
    }
}