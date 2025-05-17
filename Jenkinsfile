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
                
                if [ ! -f junit.xml ]; then
                    echo '<?xml version="1.0"?>
                    <testsuites>
                      <testsuite name="Jest Tests" tests="1" failures="1">
                        <testcase name="TestExecutionFailed" classname="Jest">
                          <failure message="Erreur d\\'exécution des tests - jest-junit non trouvé"/>
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
                        # Configurer kubectl
                        kubectl config set-credentials jenkins --token=\${K8S_TOKEN}
                        kubectl config set-cluster k3s --server=https://\$(hostname -I | awk '{print \$1}'):6443 --insecure-skip-tls-verify
                        kubectl config set-context jenkins --cluster=k3s --user=jenkins --namespace=${env.K8S_NAMESPACE}
                        kubectl config use-context jenkins
                        
                        # Mise à jour de l'image dans le deployment
                        kubectl set image deployment/api-gateway api-gateway=${env.DOCKER_IMAGE}:${env.DOCKER_TAG} -n ${env.K8S_NAMESPACE}
                        
                        # Vérification du déploiement
                        kubectl rollout status deployment/api-gateway -n ${env.K8S_NAMESPACE} --timeout=120s
                        
                        # Vérification des ressources
                        echo "=== État du déploiement ==="
                        kubectl get deployments -n ${env.K8S_NAMESPACE}
                        echo "=== État des pods ==="
                        kubectl get pods -n ${env.K8S_NAMESPACE}
                        """
                    }
                }
            }
        }

        stage('Verify Deployment') {
            steps {
                script {
                    withCredentials([string(credentialsId: 'k3s-jenkins-token', variable: 'K8S_TOKEN')]) {
                        sh """
                        # Configurer l'accès temporaire
                        export KUBECONFIG=/tmp/kubeconfig-${env.BUILD_NUMBER}
                        kubectl config set-credentials jenkins --token=\${K8S_TOKEN}
                        kubectl config set-cluster k3s --server=https://\$(hostname -I | awk '{print \$1}'):6443 --insecure-skip-tls-verify
                        kubectl config set-context jenkins --cluster=k3s --user=jenkins --namespace=${env.K8S_NAMESPACE}
                        kubectl config use-context jenkins
                        
                        # Vérifier les ressources
                        echo "=== Pods ==="
                        kubectl get pods -o wide -n ${env.K8S_NAMESPACE}
                        
                        echo "=== Services ==="
                        kubectl get svc -n ${env.K8S_NAMESPACE}
                        
                        # Test de santé
                        SERVICE_URL=\$(kubectl get svc api-gateway-service -n ${env.K8S_NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[0].ip}' || kubectl get svc api-gateway-service -n ${env.K8S_NAMESPACE} -o jsonpath='{.spec.clusterIP}')
                        SERVICE_PORT=\$(kubectl get svc api-gateway-service -n ${env.K8S_NAMESPACE} -o jsonpath='{.spec.ports[0].port}')
                        echo "URL du service: http://\${SERVICE_URL}:\${SERVICE_PORT}"
                        
                        echo "=== Test de santé ==="
                        curl -v http://\${SERVICE_URL}:\${SERVICE_PORT}/health
                        
                        # Nettoyer
                        rm \${KUBECONFIG}
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