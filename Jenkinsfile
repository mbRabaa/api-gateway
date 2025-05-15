pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps { checkout scm }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
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
                
                // Archivage des résultats
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
            echo "Build terminé - Statut: ${currentBuild.currentResult}"
        }
    }
}