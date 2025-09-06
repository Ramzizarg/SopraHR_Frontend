FROM openjdk:17-jdk-alpine

WORKDIR /app

COPY target/ramzizargelayoun-devops-5se2.jar /app/ramzizargelayoun-devops-5se2.jar

CMD ["java", "-jar", "/app/ramzizargelayoun-devops-5se2.jar"]
