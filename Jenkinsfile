pipeline {
    agent any
    
    environment {
        NODE_VERSION = '16'
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Setup Node') {
            steps {
                nodejs(nodeJSInstallationName: 'Node16') {
                    sh 'node --version'
                    sh 'npm --version'
                }
            }
        }
        
        stage('Install') {
            steps {
                sh 'npm install'
            }
        }
        
        stage('Test') {
            steps {
                sh 'npm run test:ci'
                
                // Archive les résultats
                junit 'reports/junit.xml'
                publishHTML target: [
                    allowMissing: false,
                    reportDir: 'coverage/lcov-report',
                    reportFiles: 'index.html',
                    reportName: 'Code Coverage Report'
                ]
            }
        }
    }
    
    post {
        always {
            echo 'Nettoyage des fichiers temporaires...'
        }
        failure {
            mail to: 'elmbarkirbea@gmail.com',
                 subject: "Échec du Pipeline API Gateway - Build #${env.BUILD_NUMBER}",
                 body: "Veuillez vérifier la build: ${env.BUILD_URL}"
        }
    }
}