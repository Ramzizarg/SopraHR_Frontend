# 🏢 Workstation Management Application

A full-stack web application designed to streamline telework planning and workstation reservations, ensuring efficient space utilization and optimized workforce scheduling.

## 📌 Project Overview

This application provides a seamless experience for employees and administrators to manage dynamic workspaces, schedule telework days, and monitor office occupancy. It is built with a microservices architecture using Spring Boot for the backend and Angular for the frontend.

## 🔥 Key Features

-   🖥️ **Dynamic Workstation Reservation**: Book available workstations based on real-time availability.
-   🏠 **Automatic Telework Planning**: The system generates optimized telework schedules to balance office presence.
-   📆 **Telework & Office Planning**: View and manage your in-office and remote work schedules.
-   📊 **Dashboard & Analytics**: Track workstation occupancy rates and employee presence with insightful metrics.
-   🔐 **Secure Authentication**: User authentication with role-based access control.
-   ⚙️ **Admin Panel**: Manage workstation availability, employee assignments, and policy settings.

## 🛠️ Tech Stack

### Backend

-   **Spring Boot**: For building robust microservices.
-   **Spring Cloud**: For service discovery with Eureka.
-   **Spring Data JPA**: For data persistence.
-   **Spring Security**: For authentication and authorization.
-   **Maven**: For dependency management.

### Frontend

-   **Angular**: For building a dynamic single-page application.
-   **Bootstrap**: For responsive UI components.
-   **PrimeNG**: For a rich set of UI components.
-   **Chart.js**: For creating interactive charts and dashboards.
-   **RxJS**: For reactive programming.

## 📁 Project Structure

The project is divided into two main parts:

-   `workstation-spring`: The backend, containing all the Java-based microservices.
-   `workstation-angular`: The frontend Angular application.

## ✅ Prerequisites

Before you begin, ensure you have the following installed:

-   **Java Development Kit (JDK) 17**
-   **Apache Maven**
-   **Node.js (which includes npm)**

## 🚀 Getting Started

Follow these instructions to get the project up and running on your local machine.

### 1. Backend Setup (Spring Boot)

The backend consists of several microservices. Start the `eureka-server` first.

1.  **Start the Eureka Discovery Server:**
    Open a terminal, navigate to the `eureka-server` directory, and run the app:
    ```bash
    cd workstation-spring/eureka-server
    mvn spring-boot:run
    ```
    Access the Eureka dashboard at `http://localhost:8761`.

2.  **Start the Other Microservices:**
    For each service below, open a **new terminal**, navigate to its directory, and run `mvn spring-boot:run`.
    -   `analytics-service`
    -   `contact-service`
    -   `planning-service`
    -   `reservation-service`
    -   `teletravail-service`
    -   `user-service`
    -   `workstation-service`

    For example, to start the `user-service`:
    ```bash
    cd workstation-spring/user-service
    mvn spring-boot:run
    ```

### 2. Frontend Setup (Angular)

Once all backend services are running, start the frontend.

1.  **Navigate to the frontend directory:**
    ```bash
    cd workstation-angular
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Start the development server:**
    ```bash
    npm start
    ```
    The application will be served at `http://localhost:4200`.

## ✨ Screenshots

<!-- Add screenshots of your application here -->
| Login Page | Dashboard | Reservation |
| :---: | :---: | :---: |
| ![Login](link_to_login_screenshot.png) | ![Dashboard](link_to_dashboard_screenshot.png) | ![Reservation](link_to_reservation_screenshot.png) |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a pull request.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the `LICENSE` file for details.
