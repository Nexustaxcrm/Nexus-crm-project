
<?php


header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo "Method Not Allowed";
    exit();
}

// All form values
$footerEmail = $_POST['email'];
$subject ="New Subscription";

$to = 'themearch@gmail.com';
$headers = 'From: "'.$footerEmail.'"';

// Construct email body
$body .= "Subject: $subject\n";
$body .= "Message: $footerEmail";

// Send email
$send = mail($to, $subject, $body, $headers);

// Check if email was sent successfully
if ($send) {
    echo "Email has been sent successfully.";
} else {
    echo "Failed to send email.";
}
?>