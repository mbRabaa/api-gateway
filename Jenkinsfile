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
                echo "Exécution des tests..."
                npm test || true
                
                # Fallback amélioré
                if [ ! -f junit.xml ]; then
                    echo '<?xml version="1.0"?>
                    <testsuites>
                      <testsuite name="Jest Tests" tests="1" failures="1">
                        <testcase name="TestExecutionFailed" classname="Jest">
                          <failure message="Erreur d\'exécution des tests - jest-junit non trouvé"/>
                        </testcase>
                      </testsuite>
                    </testsuites>' > junit.xml
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
                    withCredentials([usernamePassword(
                        credentialsId: 'docker-hub-creds',
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )]) {
                        sh """
                        echo "${DOCKER_PASS}" | docker login -u "${DOCKER_USER}" --password-stdin
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
                        echo "${DOCKER_PASS}" | docker login -u "${DOCKER_USER}" --password-stdin
                        docker push ${env.DOCKER_IMAGE}:${env.DOCKER_TAG}
                        docker tag ${env.DOCKER_IMAGE}:${env.DOCKER_TAG} ${env.DOCKER_IMAGE}:latest
                        docker push ${env.DOCKER_IMAGE}:latest
                        """
                    }
                }
            }
        }

        stage('Deploy to Docker') {
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
                }
            }
        }

        stage('Health Check - Docker') {
            steps {
                script {
                    sh """
                    echo "Vérification du déploiement Docker..."
                    sleep 15
                    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${env.HOST_PORT}/health)
                    if [ "\$HTTP_STATUS" -eq 200 ]; then
                        echo "Health check réussi (Status: \$HTTP_STATUS)"
                    else
                        echo "Échec du health check (Status: \$HTTP_STATUS)"
                        docker logs ${env.CONTAINER_NAME} --tail 50
                        exit 1
                    fi
                    """
                }
            }
        }

        stage('Deploy to k3s') {
            when {
                expression { currentBuild.resultIsBetterOrEqualTo('UNSTABLE') }
            }
            steps {
                script {
                    sh """
                    # Appliquer les configurations
                    sed -i 's/\${DOCKER_TAG}/${env.DOCKER_TAG}/g' k8s/deployment.yaml
                    kubectl apply -f k8s/deployment.yaml -n ${env.K8S_NAMESPACE}
                    kubectl apply -f k8s/service.yaml -n ${env.K8S_NAMESPACE}
                    
                    # Vérifier le déploiement
                    kubectl rollout status deployment/api-gateway -n ${env.K8S_NAMESPACE} --timeout=120s
                    """
                }
            }
        }

        stage('Verify k3s Deployment') {
            steps {
                script {
                    sh """
                    # Vérifier l'accès
                    NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
                    NODE_PORT=$(kubectl get svc api-gateway-service -n ${env.K8S_NAMESPACE} -o jsonpath='{.spec.ports[0].nodePort}')
                    
                    echo "=== Accès API Gateway ==="
                    echo "URL: http://\${NODE_IP}:\${NODE_PORT}"
                    echo "Test de santé:"
                    curl -v http://\${NODE_IP}:\${NODE_PORT}/health
                    
                    # Vérifier les logs
                    kubectl logs -n ${env.K8S_NAMESPACE} -l app=api-gateway --tail=20
                    """
                }
            }
        }
    }

    post {
        always {
            echo "Build status: ${currentBuild.currentResult}"
            script {
                def commitId = readFile('.git/commit-id').trim()
                currentBuild.description = "Build #${env.BUILD_NUMBER} (${commitId.take(7)})"
            }
            cleanWs()
        }
        failure {
            slackSend color: 'danger', 
                     message: "Échec du build ${env.JOB_NAME} #${env.BUILD_NUMBER} (${currentBuild.currentResult})"
        }
        success {
            slackSend color: 'good', 
                     message: "Succès du build ${env.JOB_NAME} #${env.BUILD_NUMBER}"
        }
    }
}