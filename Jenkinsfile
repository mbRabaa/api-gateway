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
                script {
                    sh('''#!/bin/bash
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
                    ''')
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
                        sh('''#!/bin/bash
                        echo "${DOCKER_PASS}" | docker login -u "${DOCKER_USER}" --password-stdin
                        docker build -t ''' + env.DOCKER_IMAGE + ''':''' + env.DOCKER_TAG + ''' .
                        ''')
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
                        sh('''#!/bin/bash
                        echo "${DOCKER_PASS}" | docker login -u "${DOCKER_USER}" --password-stdin
                        docker push ''' + env.DOCKER_IMAGE + ''':''' + env.DOCKER_TAG + '''
                        docker tag ''' + env.DOCKER_IMAGE + ''':''' + env.DOCKER_TAG + ''' ''' + env.DOCKER_IMAGE + ''':latest
                        docker push ''' + env.DOCKER_IMAGE + ''':latest
                        ''')
                    }
                }
            }
        }

        stage('Deploy to k3s') {
            when {
                expression { currentBuild.resultIsBetterOrEqualTo('UNSTABLE') }
            }
            steps {
                script {
                    withCredentials([string(credentialsId: 'k3s-jenkins-token', variable: 'K8S_TOKEN')]) {
                        sh('''#!/bin/bash
                        # Configurer l'accès kubectl
                        kubectl config set-credentials jenkins --token=''' + K8S_TOKEN + '''
                        kubectl config set-cluster k3s --server=https://$(hostname -I | awk \'{print $1}\'):6443 --insecure-skip-tls-verify
                        kubectl config set-context jenkins --cluster=k3s --user=jenkins --namespace=''' + env.K8S_NAMESPACE + '''
                        kubectl config use-context jenkins
                        
                        # Mettre à jour l'image dans le deployment
                        sed -i "s/\\${DOCKER_TAG}/''' + env.DOCKER_TAG + '''/g" k8s/deployment.yaml
                        
                        # Appliquer les configurations
                        kubectl apply -f k8s/deployment.yaml
                        kubectl apply -f k8s/service.yaml
                        
                        # Vérifier le déploiement
                        kubectl rollout status deployment/api-gateway --timeout=120s
                        ''')
                    }
                }
            }
        }

        stage('Verify Deployment') {
            steps {
                script {
                    withCredentials([string(credentialsId: 'k3s-jenkins-token', variable: 'K8S_TOKEN')]) {
                        sh('''#!/bin/bash
                        # Configurer l'accès temporaire
                        export KUBECONFIG=/tmp/kubeconfig-''' + env.BUILD_NUMBER + '''
                        kubectl config set-credentials jenkins --token=''' + K8S_TOKEN + '''
                        kubectl config set-cluster k3s --server=https://$(hostname -I | awk \'{print $1}\'):6443 --insecure-skip-tls-verify
                        kubectl config set-context jenkins --cluster=k3s --user=jenkins --namespace=''' + env.K8S_NAMESPACE + '''
                        kubectl config use-context jenkins
                        
                        # Vérifier les ressources
                        echo "=== Pods ==="
                        kubectl get pods -o wide
                        
                        echo "=== Services ==="
                        kubectl get svc
                        
                        echo "=== Déploiement ==="
                        kubectl get deployment
                        
                        # Test de santé
                        NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
                        NODE_PORT=$(kubectl get svc api-gateway-service -o jsonpath='{.spec.ports[0].nodePort}')
                        echo "URL du service: http://${NODE_IP}:${NODE_PORT}"
                        
                        echo "=== Test de santé ==="
                        curl -v http://${NODE_IP}:${NODE_PORT}/health
                        
                        # Nettoyer
                        rm ${KUBECONFIG}
                        ''')
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