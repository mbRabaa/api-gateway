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
                // L'archivage des résultats est supprimé
            }
        }
    }

    post {
        always {
            echo "Build terminé - Statut: ${currentBuild.currentResult}"
        }
    }
}