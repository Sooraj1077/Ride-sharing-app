-- SwiftRide Database Schema (MySQL)
-- Suitable for beginner students learning MySQL and JDBC

CREATE DATABASE IF NOT EXISTS ride_sharing_db;
USE ride_sharing_db;

-- 1. Users Table (Riders)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- Storing hashed password (or plain for simplicity)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Drivers Table
CREATE TABLE IF NOT EXISTS drivers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL, -- Bike, Car, SUV (No Sedan)
    vehicle_number VARCHAR(20) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'Available', -- Available, Busy, Offline
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Rides Table
CREATE TABLE IF NOT EXISTS rides (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    driver_id INT DEFAULT NULL,
    pickup_location VARCHAR(255) NOT NULL,
    drop_location VARCHAR(255) NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL,
    fare DECIMAL(10, 2) NOT NULL, -- Currency represented as RE
    status VARCHAR(20) DEFAULT 'Pending', -- Pending, Accepted, Rejected, Arrived, Ongoing, Completed, Cancelled
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL
);

-- 4. Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ride_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL, -- Card, UPI, Cash
    payment_status VARCHAR(20) DEFAULT 'Completed',
    transaction_id VARCHAR(100) UNIQUE DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE
);

-- Insert Sample Drivers for testing (Bike, Car, SUV)
INSERT INTO drivers (name, email, phone, vehicle_type, vehicle_number, status) 
VALUES 
('John Doe', 'john@driver.com', '9876543210', 'Car', 'CAR-1234', 'Available')
ON DUPLICATE KEY UPDATE status='Available';

INSERT INTO drivers (name, email, phone, vehicle_type, vehicle_number, status) 
VALUES 
('Jane Smith', 'jane@driver.com', '9876543211', 'SUV', 'SUV-5678', 'Available')
ON DUPLICATE KEY UPDATE status='Available';

INSERT INTO drivers (name, email, phone, vehicle_type, vehicle_number, status) 
VALUES 
('Mike Johnson', 'mike@driver.com', '9876543212', 'Bike', 'BIKE-999', 'Available')
ON DUPLICATE KEY UPDATE status='Available';