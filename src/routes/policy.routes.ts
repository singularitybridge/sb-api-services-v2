import express from 'express';

const router = express.Router();

router.get('/policy', (req, res) => {
    res.send(`
    # Privacy Policy

    ## Personal Information

    We do not collect any personal information about the users of our apps.

    ## Non-Personal Information

    We do not collect non-personal information like user's behavior:

    1. to solve App problems
    2. to show personalized ads

    The user is free to either accept or reject these requests.

    ## Contact Us

    If you have any questions regarding privacy while using the Application, or have questions about our practices, please contact us via email at support@example.com.
    `);
});

export default router;