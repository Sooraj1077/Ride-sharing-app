import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * App.java
 * 
 * A beginner-friendly standalone Java class demonstrating JDBC (Java Database Connectivity)
 * for the Ride Sharing Web Application.
 * 
 * This class contains example methods showing how to:
 * 1. Establish a connection to the MySQL database.
 * 2. Register/Insert a new user (Rider).
 * 3. Log a new ride booking request.
 * 4. Update the status of a ride.
 * 5. Record a ride payment.
 */
public class App {

    // Database connection details
    private static final String DB_URL = "jdbc:mysql://localhost:3306/ride_sharing_db";
    private static final String DB_USER = "root";
    private static final String DB_PASSWORD = "";

    /**
     * Obtains a connection to the database.
     * 
     * @return Connection object
     * @throws SQLException if a database error occurs
     */
    public static Connection getConnection() throws SQLException {
        try {
            // Load MySQL JDBC driver class
            Class.forName("com.mysql.cj.jdbc.Driver");
        } catch (ClassNotFoundException e) {
            System.err.println("MySQL JDBC Driver class not found.");
            e.printStackTrace();
        }
        return DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
    }

    /**
     * Registers a new user (rider) in the 'users' table.
     * 
     * @param name User's full name
     * @param email User's email (unique)
     * @param phone User's phone (unique)
     * @param password User's password
     * @return User ID if successful, -1 otherwise
     */
    public static int registerUser(String name, String email, String phone, String password) {
        String sql = "INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)";
        int generatedId = -1;

        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            
            pstmt.setString(1, name);
            pstmt.setString(2, email);
            pstmt.setString(3, phone);
            pstmt.setString(4, password); // Note: Should be hashed in production

            int rowsAffected = pstmt.executeUpdate();
            if (rowsAffected > 0) {
                try (ResultSet rs = pstmt.getGeneratedKeys()) {
                    if (rs.next()) {
                        generatedId = rs.getInt(1);
                    }
                }
            }
            System.out.println("User registered successfully. Assigned ID: " + generatedId);
        } catch (SQLException e) {
            System.err.println("Failed to register user: " + e.getMessage());
        }
        return generatedId;
    }

    /**
     * Inserts a new ride request in the database.
     * 
     * @param userId The ID of the rider
     * @param pickup The pickup address
     * @param drop The destination address
     * @param vehicleType The type of vehicle (Bike, Car, SUV)
     * @param fare The calculated fare in RE
     * @return The ride ID if booked successfully, -1 otherwise
     */
    public static int bookRide(int userId, String pickup, String drop, String vehicleType, double fare) {
        String sql = "INSERT INTO rides (user_id, pickup_location, drop_location, vehicle_type, fare, status) VALUES (?, ?, ?, ?, ?, 'Pending')";
        int rideId = -1;

        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            
            pstmt.setInt(1, userId);
            pstmt.setString(2, pickup);
            pstmt.setString(3, drop);
            pstmt.setString(4, vehicleType);
            pstmt.setDouble(5, fare);

            int rowsAffected = pstmt.executeUpdate();
            if (rowsAffected > 0) {
                try (ResultSet rs = pstmt.getGeneratedKeys()) {
                    if (rs.next()) {
                        rideId = rs.getInt(1);
                    }
                }
            }
            System.out.println("Ride booked successfully. Assigned Ride ID: " + rideId);
        } catch (SQLException e) {
            System.err.println("Failed to book ride: " + e.getMessage());
        }
        return rideId;
    }

    /**
     * Updates the status of an existing ride.
     * 
     * @param rideId The ID of the ride
     * @param driverId The ID of the driver accepting the ride
     * @param status The new status (Accepted, Arrived, Ongoing, Completed, Cancelled)
     * @return true if updated successfully, false otherwise
     */
    public static boolean updateRideStatus(int rideId, int driverId, String status) {
        String sql = "UPDATE rides SET driver_id = ?, status = ? WHERE id = ?";
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            
            pstmt.setInt(1, driverId);
            pstmt.setString(2, status);
            pstmt.setInt(3, rideId);

            int rowsAffected = pstmt.executeUpdate();
            System.out.println("Ride ID " + rideId + " status updated to: " + status);
            return rowsAffected > 0;
        } catch (SQLException e) {
            System.err.println("Failed to update ride status: " + e.getMessage());
            return false;
        }
    }

    /**
     * Inserts a record of payment into the 'payments' table.
     * 
     * @param rideId The ID of the completed ride
     * @param amount The transaction amount (RE)
     * @param method The payment method (Card, UPI, Cash)
     * @param txnId The mock transaction ID
     * @return true if payment stored successfully, false otherwise
     */
    public static boolean savePayment(int rideId, double amount, String method, String txnId) {
        String sql = "INSERT INTO payments (ride_id, amount, payment_method, payment_status, transaction_id) VALUES (?, ?, ?, 'Completed', ?)";
        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            
            pstmt.setInt(1, rideId);
            pstmt.setDouble(2, amount);
            pstmt.setString(3, method);
            pstmt.setString(4, txnId);

            int rowsAffected = pstmt.executeUpdate();
            System.out.println("Payment of RE " + amount + " saved for Ride ID " + rideId);
            return rowsAffected > 0;
        } catch (SQLException e) {
            System.err.println("Failed to save payment: " + e.getMessage());
            return false;
        }
    }

    /**
     * Main method demonstrating the database operation flow.
     */
    public static void main(String[] args) {
        System.out.println("--- Starting SwiftRide JDBC Demonstration ---");

        // 1. Register a Rider
        int riderId = registerUser("Alice Rider", "alice@example.com", "9999888877", "password123");

        if (riderId != -1) {
            // 2. Book a Ride (Rider requests a Car)
            int rideId = bookRide(riderId, "Main Street 123", "Central Park Mall", "Car", 45.50);

            if (rideId != -1) {
                // 3. Driver accepts the ride (Driver ID = 1, e.g., John Doe)
                updateRideStatus(rideId, 1, "Accepted");

                // 4. Update status along the ride lifecycle
                updateRideStatus(rideId, 1, "Arrived");
                updateRideStatus(rideId, 1, "Ongoing");
                updateRideStatus(rideId, 1, "Completed");

                // 5. Save the payment details
                savePayment(rideId, 45.50, "UPI", "TXN-" + System.currentTimeMillis());
            }
        }
        System.out.println("--- Demo Completed ---");
    }
}