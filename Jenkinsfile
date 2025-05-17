pipeline {
    agent any
    options {
        skipDefaultCheckout true
    }

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
        K8S_NAMESPACE = 'frontend'
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
                npm install jest-junit jest --save-dev
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
                script {
                    try {
                        sh '''
                        NODE_ENV=test jest --ci --coverage --reporters=default --reporters=jest-junit
                        '''
                    } catch (e) {
                        echo "Tests failed, creating fallback report"
                        sh '''
                        echo '<?xml version="1.0"?>
                        <testsuites>
                          <testsuite name="Jest Tests" tests="1" failures="1">
                            <testcase name="TestExecutionFailed" classname="Jest">
                              <failure message="Tests failed with error"/>
                            </testcase>
                          </testsuite>
                        </testsuites>' > junit.xml
                        '''
                        currentBuild.result = 'UNSTABLE'
                    }
                }
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
                    withCredentials([usernamePassword(
                        credentialsId: 'docker-hub-creds',
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )]) {
                        sh """
                        echo "\${DOCKER_PASS}" | docker login -u "\${DOCKER_USER}" --password-stdin
                        docker build -t ${env.DOCKER_IMAGE}:${env.DOCKER_TAG} .
                        """
                    }
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
                        echo "\${DOCKER_PASS}" | docker login -u "\${DOCKER_USER}" --password-stdin
                        docker push ${env.DOCKER_IMAGE}:${env.DOCKER_TAG}
                        docker tag ${env.DOCKER_IMAGE}:${env.DOCKER_TAG} ${env.DOCKER_IMAGE}:latest
                        docker push ${env.DOCKER_IMAGE}:latest
                        """
                    }
                }
            }
        }

        stage('Deploy to Kubernetes') {
            when {
                expression { currentBuild.resultIsBetterOrEqualTo('UNSTABLE') }
            }
            steps {
                script {
                    withCredentials([string(credentialsId: 'k3s-jenkins-token', variable: 'K8S_TOKEN')]) {
                        sh """
                        # Configurer kubectl pour Jenkins
                        mkdir -p ~/.kube
                        kubectl config set-cluster k3s --server=https://\$(hostname -I | awk '{print \$1}'):6443 --insecure-skip-tls-verify
                        kubectl config set-credentials jenkins --token=\${K8S_TOKEN}
                        kubectl config set-context jenkins --cluster=k3s --user=jenkins --namespace=${env.K8S_NAMESPACE}
                        kubectl config use-context jenkins

                        # Mettre à jour et appliquer le déploiement
                        sed -i "s|image:.*|image: ${env.DOCKER_IMAGE}:${env.DOCKER_TAG}|g" k8s/deployment.yaml
                        kubectl apply -f k8s/deployment.yaml -n ${env.K8S_NAMESPACE}
                        kubectl rollout status deployment/api-gateway -n ${env.K8S_NAMESPACE} --timeout=180s
                        """
                    }
                }
            }
        }
    }

    post {
        always {
            echo "Build status: ${currentBuild.currentResult}"
            script {
                try {
                    def commitId = readFile('.git/commit-id').trim()
                    currentBuild.description = "Build #${env.BUILD_NUMBER} (${commitId.take(7)})"
                } catch (e) {
                    echo "Could not read commit ID: ${e.message}"
                    currentBuild.description = "Build #${env.BUILD_NUMBER}"
                }
            }
            cleanWs()
        }
        failure {
            script {
                try {
                    def commitId = readFile('.git/commit-id').trim()
                    emailext (
                        subject: "ÉCHEC du build ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                        body: """
                        Détails de l'échec:
                        - URL du build: ${env.BUILD_URL}
                        - Commit: ${commitId.take(7)}
                        - Cause: ${currentBuild.currentResult}
                        """,
                        to: 'elmbarkirabea@gmail.com',
                        replyTo: 'elmbarkirabea@gmail.com',
                        attachLog: true
                    )
                } catch (e) {
                    emailext (
                        subject: "ÉCHEC du build ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                        body: """
                        Détails de l'échec:
                        - URL du build: ${env.BUILD_URL}
                        - Cause: ${currentBuild.currentResult}
                        """,
                        to: 'elmbarkirabea@gmail.com',
                        replyTo: 'elmbarkirabea@gmail.com',
                        attachLog: true
                    )
                }
            }
        }
        success {
            script {
                def commitId = readFile('.git/commit-id').trim()
                emailext (
                    subject: "SUCCÈS du build ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                    body: """
                    Détails du build réussi:
                    - Image Docker: ${env.DOCKER_IMAGE}:${env.DOCKER_TAG}
                    - Déployé dans: namespace ${env.K8S_NAMESPACE}
                    - URL du build: ${env.BUILD_URL}
                    - Commit: ${commitId.take(7)}
                    """,
                    to: 'eelmbarkirabea@gmail.com'
                )
            }
        }
    }
}