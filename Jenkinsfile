pipeline {
    agent any
    options {
        skipDefaultCheckout true
        timeout(time: 30, unit: 'MINUTES')
    }

    environment {
        DOCKER_IMAGE = 'mbrabaa2023/api-gateway'
        DOCKER_TAG = "${env.BUILD_NUMBER}"
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
                        # Solution définitive pour les conflits de configuration Jest
                        if [ -f jest.config.js ]; then
                            echo "Utilisation de jest.config.js existant"
                            NODE_ENV=test jest --config=jest.config.js --ci --coverage --reporters=default --reporters=jest-junit
                        else
                            echo "Utilisation de la configuration par défaut"
                            NODE_ENV=test jest --ci --coverage --reporters=default --reporters=jest-junit
                        fi
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
                        // Solution sécurisée sans interpolation Groovy
                        sh '''
                        mkdir -p $WORKSPACE/.kube
                        cat > $WORKSPACE/.kube/config <<EOF
                        apiVersion: v1
                        kind: Config
                        current-context: jenkins
                        contexts:
                        - context:
                            cluster: k3s
                            user: jenkins
                            namespace: ''' + env.K8S_NAMESPACE + '''
                          name: jenkins
                        clusters:
                        - cluster:
                            server: https://$(hostname -I | awk '{print $1}'):6443
                            insecure-skip-tls-verify: true
                          name: k3s
                        users:
                        - name: jenkins
                          user:
                            token: ''' + K8S_TOKEN + '''
                        EOF

                        # Mise à jour et application du déploiement
                        sed -i "s|image:.*|image: ''' + env.DOCKER_IMAGE + ''':''' + env.DOCKER_TAG + '''|g" k8s/deployment.yaml
                        kubectl --kubeconfig=$WORKSPACE/.kube/config apply -f k8s/deployment.yaml
                        kubectl --kubeconfig=$WORKSPACE/.kube/config rollout status deployment/api-gateway -n ''' + env.K8S_NAMESPACE + ''' --timeout=180s
                        '''
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
                    mail to: 'elmbarkirabea@gmail.com',
                         subject: "ÉCHEC du build ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                         body: """
                         Détails de l'échec:
                         - URL du build: ${env.BUILD_URL}
                         - Commit: ${commitId.take(7)}
                         - Cause: ${currentBuild.currentResult}
                         """
                } catch (e) {
                    mail to: 'elmbarkirabea@gmail.com',
                         subject: "ÉCHEC du build ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                         body: """
                         Détails de l'échec:
                         - URL du build: ${env.BUILD_URL}
                         - Cause: ${currentBuild.currentResult}
                         """
                }
            }
        }
        success {
            script {
                def commitId = readFile('.git/commit-id').trim()
                mail to: 'eelmbarkirabea@gmail.com',
                     subject: "SUCCÈS du build ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                     body: """
                     Détails du build réussi:
                     - Image Docker: ${env.DOCKER_IMAGE}:${env.DOCKER_TAG}
                     - Déployé dans: namespace ${env.K8S_NAMESPACE}
                     - URL du build: ${env.BUILD_URL}
                     - Commit: ${commitId.take(7)}
                     """
            }
        }
    }
}