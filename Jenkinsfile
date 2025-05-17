pipeline {
    agent any

    environment {
        // Docker Configuration
        DOCKER_IMAGE = 'mbrabaa2023/api-gateway'
        DOCKER_TAG = "${env.BUILD_NUMBER}"
        CONTAINER_NAME = 'api-gateway-container'
        
        // Ports Configuration
        HOST_PORT = '8000'
        CONTAINER_PORT = '8000'
        
        // Services URLs
        FRONTEND_URL = 'http://localhost:8080'
        PAIEMENT_SERVICE_URL = 'http://localhost:3002'
        RESERVATION_SERVICE_URL = 'http://localhost:3004'
        TRAJET_SERVICE_URL = 'http://localhost:3005'
        
        // Node Configuration
        NODE_ENV = 'production'
        DOCKER_REGISTRY = 'https://index.docker.io/v1/'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh 'git rev-parse HEAD > .git/commit-id'
                sh 'cat .git/commit-id'
            }
        }

        stage('Clean Workspace') {
            steps {
                sh '''
                echo "Cleaning workspace..."
                rm -rf node_modules || true
                rm -f package-lock.json || true
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                echo "Installing dependencies..."
                npm install --legacy-peer-deps
                npm install jest-junit --save-dev
                npm install debug@latest --save
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
                npm test
                '''
            }
            post {
                always {
                    junit 'reports/**/*.xml'
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
                        echo "${DOCKER_PASS}" | docker login -u "${DOCKER_USER}" --password-stdin ${env.DOCKER_REGISTRY}
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
                    echo "Health check:"
                    sleep 10
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
            mail to: 'elmbarkirabea@gmail.com',
                 subject: "SUCCESS: Job '${env.JOB_NAME}' (${env.BUILD_NUMBER})",
                 body: "Build successful\n\n${env.BUILD_URL}"
        }
        failure {
            mail to: 'elmbarkirabea@gmail.com',
                 subject: "FAILED: Job '${env.JOB_NAME}' (${env.BUILD_NUMBER})",
                 body: "Build failed\n\n${env.BUILD_URL}"
        }
    }
}