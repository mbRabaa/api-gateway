post {
    always {
        echo "Build terminé - Statut: ${currentBuild.currentResult}"
        sh 'docker logout || true'
        sh 'docker image prune -f || true'
        
        // Archive les fichiers importants
        archiveArtifacts artifacts: 'server.js,config/*.json', fingerprint: true
        
        // Archive la liste des dépendances
        sh 'npm list --depth=0 > dependencies.txt'
        archiveArtifacts artifacts: 'dependencies.txt'
    }
    
    success {
        emailext (
            body: """Build ${BUILD_NUMBER} réussi!
                   |URL du build: ${BUILD_URL}
                   |Image Docker: ${env.DOCKER_IMAGE}:${env.DOCKER_TAG}
                   |Conteneur: ${env.CONTAINER_NAME} (port ${env.HOST_PORT})""".stripMargin(), 
            subject: "[SUCCÈS] Build ${BUILD_NUMBER} - API Gateway",
            to: 'elmbarkirbea@gmail.com'
        )
    }
    
    failure {
        emailext (
            body: """Build ${BUILD_NUMBER} a échoué!
                   |URL du build: ${BUILD_URL}
                   |Consulter les logs pour plus de détails""".stripMargin(),
            subject: "[ÉCHEC] Build ${BUILD_NUMBER} - API Gateway",
            to: 'elmbarkirbea@gmail.com'
        )
    }
}