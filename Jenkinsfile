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
                script {
                    try {
                        // Installation explicite des dépendances de test
                        sh 'npm install jest-junit --save-dev'
                        
                        // Exécution des tests avec configuration explicite
                        sh '''
                        echo "Exécution des tests..."
                        NODE_ENV=test jest --config=jest.config.js \
                        --ci \
                        --reporters=default \
                        --reporters=jest-junit \
                        --coverage \
                        --forceExit \
                        --detectOpenHandles \
                        --testResultsProcessor="jest-junit"
                        '''
                    } catch (e) {
                        // Fallback si les tests échouent
                        sh '''
                        echo '<?xml version="1.0"?>
                        <testsuites>
                          <testsuite name="Jest Tests" tests="1" failures="1">
                            <testcase name="TestExecutionFailed" classname="Jest">
                              <failure message="Erreur d\\'exécution des tests"/>
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
                        # Configuration de l'accès kubectl
                        kubectl config set-credentials jenkins --token=\${K8S_TOKEN}
                        kubectl config set-cluster k3s --server=https://\$(hostname -I | awk '{print \$1}'):6443 --insecure-skip-tls-verify
                        kubectl config set-context jenkins --cluster=k3s --user=jenkins --namespace=${env.K8S_NAMESPACE}
                        kubectl config use-context jenkins

                        # Mise à jour du déploiement
                        kubectl set image deployment/api-gateway api-gateway=${env.DOCKER_IMAGE}:${env.DOCKER_TAG} -n ${env.K8S_NAMESPACE}
                        
                        # Vérification du déploiement
                        kubectl rollout status deployment/api-gateway -n ${env.K8S_NAMESPACE} --timeout=300s
                        
                        # Vérification des ressources
                        echo "=== État du déploiement ==="
                        kubectl get deployments -n ${env.K8S_NAMESPACE} -o wide
                        echo "=== État des pods ==="
                        kubectl get pods -n ${env.K8S_NAMESPACE} -o wide
                        echo "=== État des services ==="
                        kubectl get svc -n ${env.K8S_NAMESPACE} -o wide
                        """
                    }
                }
            }
        }

        stage('Verify Deployment') {
            when {
                expression { currentBuild.resultIsBetterOrEqualTo('UNSTABLE') }
            }
            steps {
                script {
                    withCredentials([string(credentialsId: 'k3s-jenkins-token', variable: 'K8S_TOKEN')]) {
                        sh """
                        # Configuration temporaire
                        export KUBECONFIG=/tmp/kubeconfig-${env.BUILD_NUMBER}
                        kubectl config set-credentials jenkins --token=\${K8S_TOKEN}
                        kubectl config set-cluster k3s --server=https://\$(hostname -I | awk '{print \$1}'):6443 --insecure-skip-tls-verify
                        kubectl config set-context jenkins --cluster=k3s --user=jenkins --namespace=${env.K8S_NAMESPACE}
                        kubectl config use-context jenkins

                        # Test de santé
                        SERVICE_IP=\$(kubectl get svc api-gateway-service -n ${env.K8S_NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
                        if [ -z "\$SERVICE_IP" ]; then
                            SERVICE_IP=\$(kubectl get svc api-gateway-service -n ${env.K8S_NAMESPACE} -o jsonpath='{.spec.clusterIP}')
                        fi
                        SERVICE_PORT=\$(kubectl get svc api-gateway-service -n ${env.K8S_NAMESPACE} -o jsonpath='{.spec.ports[0].port}')
                        
                        echo "=== Test de santé sur http://\${SERVICE_IP}:\${SERVICE_PORT}/health ==="
                        curl -v --retry 5 --retry-delay 10 --max-time 30 http://\${SERVICE_IP}:\${SERVICE_PORT}/health
                        
                        # Nettoyage
                        rm -f \${KUBECONFIG}
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
            emailext (
                subject: "ÉCHEC du build ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                body: """
                Le build ${env.BUILD_URL} a échoué
                Statut: ${currentBuild.currentResult}
                Commit: ${commitId.take(7)}
                Consultez les logs pour plus de détails.
                """,
                to: 'votre@email.com'
            )
        }
        success {
            emailext (
                subject: "SUCCÈS du build ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                body: """
                Le build ${env.BUILD_URL} a réussi
                Image Docker: ${env.DOCKER_IMAGE}:${env.DOCKER_TAG}
                Déployé dans le namespace: ${env.K8S_NAMESPACE}
                """,
                to: 'votre@email.com'
            )
        }
    }
}pipeline {
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
                script {
                    try {
                        // Installation explicite des dépendances de test
                        sh 'npm install jest-junit --save-dev'
                        
                        // Exécution des tests avec configuration explicite
                        sh '''
                        echo "Exécution des tests..."
                        NODE_ENV=test jest --config=jest.config.js \
                        --ci \
                        --reporters=default \
                        --reporters=jest-junit \
                        --coverage \
                        --forceExit \
                        --detectOpenHandles \
                        --testResultsProcessor="jest-junit"
                        '''
                    } catch (e) {
                        // Fallback si les tests échouent
                        sh '''
                        echo '<?xml version="1.0"?>
                        <testsuites>
                          <testsuite name="Jest Tests" tests="1" failures="1">
                            <testcase name="TestExecutionFailed" classname="Jest">
                              <failure message="Erreur d\\'exécution des tests"/>
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
                        # Configuration de l'accès kubectl
                        kubectl config set-credentials jenkins --token=\${K8S_TOKEN}
                        kubectl config set-cluster k3s --server=https://\$(hostname -I | awk '{print \$1}'):6443 --insecure-skip-tls-verify
                        kubectl config set-context jenkins --cluster=k3s --user=jenkins --namespace=${env.K8S_NAMESPACE}
                        kubectl config use-context jenkins

                        # Mise à jour du déploiement
                        kubectl set image deployment/api-gateway api-gateway=${env.DOCKER_IMAGE}:${env.DOCKER_TAG} -n ${env.K8S_NAMESPACE}
                        
                        # Vérification du déploiement
                        kubectl rollout status deployment/api-gateway -n ${env.K8S_NAMESPACE} --timeout=300s
                        
                        # Vérification des ressources
                        echo "=== État du déploiement ==="
                        kubectl get deployments -n ${env.K8S_NAMESPACE} -o wide
                        echo "=== État des pods ==="
                        kubectl get pods -n ${env.K8S_NAMESPACE} -o wide
                        echo "=== État des services ==="
                        kubectl get svc -n ${env.K8S_NAMESPACE} -o wide
                        """
                    }
                }
            }
        }

        stage('Verify Deployment') {
            when {
                expression { currentBuild.resultIsBetterOrEqualTo('UNSTABLE') }
            }
            steps {
                script {
                    withCredentials([string(credentialsId: 'k3s-jenkins-token', variable: 'K8S_TOKEN')]) {
                        sh """
                        # Configuration temporaire
                        export KUBECONFIG=/tmp/kubeconfig-${env.BUILD_NUMBER}
                        kubectl config set-credentials jenkins --token=\${K8S_TOKEN}
                        kubectl config set-cluster k3s --server=https://\$(hostname -I | awk '{print \$1}'):6443 --insecure-skip-tls-verify
                        kubectl config set-context jenkins --cluster=k3s --user=jenkins --namespace=${env.K8S_NAMESPACE}
                        kubectl config use-context jenkins

                        # Test de santé
                        SERVICE_IP=\$(kubectl get svc api-gateway-service -n ${env.K8S_NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
                        if [ -z "\$SERVICE_IP" ]; then
                            SERVICE_IP=\$(kubectl get svc api-gateway-service -n ${env.K8S_NAMESPACE} -o jsonpath='{.spec.clusterIP}')
                        fi
                        SERVICE_PORT=\$(kubectl get svc api-gateway-service -n ${env.K8S_NAMESPACE} -o jsonpath='{.spec.ports[0].port}')
                        
                        echo "=== Test de santé sur http://\${SERVICE_IP}:\${SERVICE_PORT}/health ==="
                        curl -v --retry 5 --retry-delay 10 --max-time 30 http://\${SERVICE_IP}:\${SERVICE_PORT}/health
                        
                        # Nettoyage
                        rm -f \${KUBECONFIG}
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
            emailext (
                subject: "ÉCHEC du build ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                body: """
                Le build ${env.BUILD_URL} a échoué
                Statut: ${currentBuild.currentResult}
                Commit: ${commitId.take(7)}
                Consultez les logs pour plus de détails.
                """,
                to: 'elmbarkirabea@gmail.com'
            )
        }
        success {
            emailext (
                subject: "SUCCÈS du build ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                body: """
                Le build ${env.BUILD_URL} a réussi
                Image Docker: ${env.DOCKER_IMAGE}:${env.DOCKER_TAG}
                Déployé dans le namespace: ${env.K8S_NAMESPACE}
                """,
                to: 'elmbarkirabea@gmail.com'
            )
        }
    }
}