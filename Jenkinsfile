pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps { checkout scm }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
                sh 'npm install -g eslint @babel/cli' // Optionnel si installé globalement
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
                junit 'reports/junit.xml'
                publishHTML target: [
                    allowMissing: true,
                    reportDir: 'coverage/lcov-report',
                    reportFiles: 'index.html',
                    reportName: 'Code Coverage'
                ]
            }
        }
    }

    post {
        always {
            echo 'Build terminé - Statut: ${currentBuild.currentResult}'
        }
    }
}