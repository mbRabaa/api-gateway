pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
                // Installation locale au projet plutôt que globale
                sh 'npx eslint --version || echo "ESLint check skipped"'
                sh 'npx babel --version || echo "Babel check skipped"'
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
                junit allowEmptyResults: true, testResults: 'reports/junit.xml'
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
        failure {
            echo "La pipeline a échoué - veuillez vérifier les logs"
        }
    }
}