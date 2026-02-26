"""
Email service for sending access request notifications.
"""
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import (
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USERNAME,
    SMTP_PASSWORD,
    SMTP_FROM_EMAIL,
)

logger = logging.getLogger(__name__)


def send_access_request_email(
    full_name: str,
    company_name: str,
    email: str,
    use_case: str,
) -> bool:
    """
    Send an access request email to the team.

    Returns True if email was sent successfully, False otherwise.
    """
    if not all([SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM_EMAIL]):
        logger.warning("[email_service] SMTP not configured, skipping email send")
        return False

    try:
        # Create message
        msg = MIMEMultipart()
        msg['From'] = SMTP_FROM_EMAIL
        msg['To'] = 'rajat@legalgraph.ai'
        msg['Subject'] = 'Request Access of Lease Research Agent'

        # Email body
        body = f"""Hi Rajat,

I would like to request access to the Lease Research Agent.

Name: {full_name}
Company: {company_name}
Email: {email}
Use Case: {use_case if use_case else 'Not provided'}

Thanks.
"""

        msg.attach(MIMEText(body, 'plain'))

        # Send email
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)

        logger.info(
            "[email_service] Access request email sent for %s (%s)",
            full_name,
            email,
        )
        return True

    except Exception as e:
        logger.error("[email_service] Failed to send email: %s", e)
        return False
