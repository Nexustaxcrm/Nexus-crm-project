<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo "Method Not Allowed";
    exit();
}

$to = 'themearch@gmail.com';

// Get form data
$name = $_POST['fullname'] ?? '';
$email = $_POST['email'] ?? '';
$phone = $_POST['phone'] ?? '';
$website = $_POST['website'] ?? '';
$budget = $_POST['budget'] ?? '';
$description = $_POST['description'] ?? '';

$headers = "From: $email\r\n";
$headers .= "Reply-To: $email\r\n";

// Construct email body
$body = "Name: $name\n";
$body .= "Email: $email\n";
$body .= "Phone: $phone\n";
$body .= "Website: $website\n";
$body .= "Budget: $budget\n";
$body .= "Message: $description";

// Send email
if (mail($to, "New Appointment Request from $name", $body, $headers)) {
    echo "Email has been sent successfully.";
} else {
    echo "Failed to send email.";
}
?>
