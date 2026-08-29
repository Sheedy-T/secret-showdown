import os

import resend


# =========================================================
# RESEND CONFIGURATION
# =========================================================

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
EMAIL_FROM = os.getenv(
    "EMAIL_FROM",
    "Secret Showdown <onboarding@resend.dev>",
)


if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


# =========================================================
# SEND HOST APPROVAL EMAIL
# =========================================================

async def send_host_approval_email(
    email: str,
    display_name: str | None = None,
):
    """
    Send an email notifying a host that their application
    has been approved.
    """

    if not RESEND_API_KEY:
        raise RuntimeError(
            "RESEND_API_KEY is not configured."
        )

    name = display_name or "Host"

    params: resend.Emails.SendParams = {
        "from": EMAIL_FROM,
        "to": [email],
        "subject": "Your Secret Showdown Host Application Has Been Approved",
        "html": f"""
        <div style="
            font-family: Arial, Helvetica, sans-serif;
            max-width: 600px;
            margin: 0 auto;
            padding: 30px;
            color: #111827;
        ">

            <div style="
                background: linear-gradient(
                    135deg,
                    #09090b,
                    #312e81,
                    #7c3aed
                );
                color: white;
                padding: 25px;
                border-radius: 14px;
                text-align: center;
            ">
                <h1 style="margin: 0;">
                    ♛ Secret Showdown
                </h1>

                <p style="
                    margin: 8px 0 0;
                    opacity: 0.8;
                ">
                    Host Access
                </p>
            </div>

            <div style="padding: 25px 5px;">

                <h2>
                    Congratulations, {name}!
                </h2>

                <p>
                    Your application to become a
                    <strong>Secret Showdown Host</strong>
                    has been approved.
                </p>

                <p>
                    You can now return to the Secret Showdown
                    Host portal and sign in using the account
                    you registered with.
                </p>

                <div style="
                    background: #f0fdf4;
                    border: 1px solid #bbf7d0;
                    border-radius: 10px;
                    padding: 15px;
                    margin: 20px 0;
                    color: #166534;
                ">
                    <strong>Status: APPROVED</strong>
                </div>

                <p>
                    Welcome to Secret Showdown.
                </p>

                <p>
                    — Secret Showdown Team
                </p>

            </div>
        </div>
        """,
    }

    return await resend.Emails.send_async(params)


# =========================================================
# SEND HOST REJECTION EMAIL
# =========================================================

async def send_host_rejection_email(
    email: str,
    display_name: str | None = None,
):
    """
    Send an email notifying a host that their application
    has been rejected.
    """

    if not RESEND_API_KEY:
        raise RuntimeError(
            "RESEND_API_KEY is not configured."
        )

    name = display_name or "Host"

    params: resend.Emails.SendParams = {
        "from": EMAIL_FROM,
        "to": [email],
        "subject": "Update on Your Secret Showdown Host Application",
        "html": f"""
        <div style="
            font-family: Arial, Helvetica, sans-serif;
            max-width: 600px;
            margin: 0 auto;
            padding: 30px;
            color: #111827;
        ">

            <div style="
                background: linear-gradient(
                    135deg,
                    #09090b,
                    #312e81,
                    #7c3aed
                );
                color: white;
                padding: 25px;
                border-radius: 14px;
                text-align: center;
            ">
                <h1 style="margin: 0;">
                    ♛ Secret Showdown
                </h1>

                <p style="
                    margin: 8px 0 0;
                    opacity: 0.8;
                ">
                    Host Access
                </p>
            </div>

            <div style="padding: 25px 5px;">

                <h2>
                    Hello, {name}
                </h2>

                <p>
                    Thank you for applying to become a
                    <strong>Secret Showdown Host</strong>.
                </p>

                <p>
                    After reviewing your application,
                    we are unable to approve your host
                    access at this time.
                </p>

                <div style="
                    background: #fef2f2;
                    border: 1px solid #fecaca;
                    border-radius: 10px;
                    padding: 15px;
                    margin: 20px 0;
                    color: #991b1b;
                ">
                    <strong>Status: REJECTED</strong>
                </div>

                <p>
                    You may check back later for any
                    future opportunities to apply.
                </p>

                <p>
                    — Secret Showdown Team
                </p>

            </div>
        </div>
        """,
    }

    return await resend.Emails.send_async(params)