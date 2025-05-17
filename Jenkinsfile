pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'mbrabaa2023/api-gateway'
        DOCKER_TAG = "${env.BUILD_ID}"
        CONTAINER_NAME = 'api-gateway-container'
        HOST_PORT = '8000'
        CONTAINER_PORT = '8000'
        NOTIFICATION_EMAIL = 'elmbarkirbea@gmail.com'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                archiveArtifacts artifacts: '**/*.js,**/*.json', excludes: 'node_modules/**', fingerprint: true
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
                archiveArtifacts artifacts: 'package-lock.json', fingerprint: true
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
                archiveArtifacts artifacts: 'dist/**/*', fingerprint: true
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
                junit '**/test-results/*.xml'
                publishHTML target: [
                    reportDir: 'coverage/lcov-report',
                    reportFiles: 'index.html',
                    reportName: 'Code Coverage Report',
                    keepAll: true
                ]
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    sh 'docker --version'
                    docker.build("${env.DOCKER_IMAGE}:${env.DOCKER_TAG}")
                    archiveArtifacts artifacts: 'Dockerfile,docker-compose*.yml', fingerprint: true
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
                    sh "docker logs ${env.CONTAINER_NAME} > container.log 2>&1 || true"
                    archiveArtifacts artifacts: 'container.log', fingerprint: true
                }
            }
        }
    }

    // Correction: Utilisation de la syntaxe post correcte
    post {
        always {
            echo "Build terminé - Statut: ${currentBuild.currentResult}"
            sh 'docker logout || true'
            sh 'docker image prune -f || true'
            
            // Archive des fichiers supplémentaires
            archiveArtifacts artifacts: 'server.js,config/*.json', fingerprint: true
            sh 'npm list --depth=0 > dependencies.txt'
            archiveArtifacts artifacts: 'dependencies.txt'
            
            // Envoi d'email conditionnel
            script {
                if (currentBuild.currentResult == 'SUCCESS') {
                    emailext (
                        body: """Build ${BUILD_NUMBER} réussi!
                               |URL: ${BUILD_URL}
                               |Image: ${env.DOCKER_IMAGE}:${env.DOCKER_TAG}
                               |Conteneur: ${env.CONTAINER_NAME}:${env.HOST_PORT}""".stripMargin(),
                        subject: "SUCCÈS: Build ${BUILD_NUMBER}",
                        to: env.NOTIFICATION_EMAIL
                    )
                } else {
                    emailext (
                        body: """Build ${BUILD_NUMBER} a échoué!
                               |URL: ${BUILD_URL}
                               |Logs: ${BUILD_URL}artifact/container.log""".stripMargin(),
                        subject: "ÉCHEC: Build ${BUILD_NUMBER}",
                        to: env.NOTIFICATION_EMAIL
                    )
                }
            }
        }
    }
}