stage('Test') {
    steps {
        script {
            try {
                // Installer explicitement jest-junit si nécessaire
                sh 'npm install jest-junit --save-dev'
                
                // Exécuter les tests avec la configuration correcte
                sh '''
                echo "Exécution des tests..."
                NODE_ENV=test jest --config=jest.config.js --ci --reporters=default --reporters=jest-junit --coverage --forceExit --detectOpenHandles
                '''
            } catch (e) {
                // Créer un fichier junit.xml minimal si les tests échouent
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