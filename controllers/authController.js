const User = require("../models/User");
const bcrypt = require("bcryptjs");
const generateToken = require("../utils/jwt");
const crypto = require("crypto");
const SessionOtp = require("../models/SessionOtp");
const sendEmail = require("../utils/sendEmail");
const { OAuth2Client } = require("google-auth-library");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
// @desc Register User
// @route POST /api/auth/register
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // validation
        if (!name || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // check existing user
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: "User already exists" });
        }

        // hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // create user
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
        });

        // response
        res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                token: generateToken(user._id),
            },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.googleAuth = async (req, res) => {
    try {
        const { token, mode } = req.body;

        if (!token) {
            return res.status(400).json({ message: "Google token is required" });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();

        const googleId = payload.sub;
        const name = payload.name || "Google User";
        const email = payload.email;
        const picture = payload.picture || "";
        const emailVerified = payload.email_verified;

        if (!emailVerified) {
            return res.status(400).json({ message: "Google email is not verified" });
        }

        let user = await User.findOne({ email });
        // console.log("user finding on gmail login",user)

        // LOGIN MODE
        if (mode === "login") {
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not registered. Please register first.",
                    email,
                    name,
                });
            }

            return res.status(200).json({
                success: true,
                message: "Google login successful",
                data: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    ProfilePic:user.profilePic,
                    token: generateToken(user._id),
                },
            });
        }

        // REGISTER MODE
        if (!user) {
            user = await User.create({
                name,
                email,
                googleId,
                profilePic: picture,
                authProvider: "google",
            });
        } else {
            if (!user.googleId) user.googleId = googleId;
            if (!user.profilePic && picture) user.profilePic = picture;
            if (!user.authProvider) user.authProvider = "google";
            await user.save();
        }

        return res.status(200).json({
            success: true,
            message: "Google registration successful",
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                profilePic: user.picture,
                token: generateToken(user._id),
            },
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message || "Google authentication failed",
        });
    }
};
// @desc Login User
// @route POST /api/auth/login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // validation
        if (!email || !password) {
            return res.status(400).json({ message: "Email & Password required" });
        }

        // check user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // compare password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        res.json({
            success: true,
            message: "Login successful",
            data: {
                _id: user._id,
                email: user.email,
                token: generateToken(user._id),
            },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// @desc Send OTP
// @route POST /api/auth/send-otp
exports.sendOtp = async (req, res) => {
    try {
        const { email } = req.body;
        console.log("otp reqbody",email)

        const user = await User.findOne({ email });
        console.log("user find for otp",user)

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const hashedOtp = crypto
            .createHash("sha256")
            .update(otp)
            .digest("hex");

        // delete previous OTPs for this email
        await SessionOtp.deleteMany({ email });

        // store new OTP
        await SessionOtp.create({
            email,
            otp: hashedOtp,
            otpExpire: Date.now() + 5 * 60 * 1000, // 5 min
        });

        // send email
        await sendEmail(
            email,
            "Password Reset OTP",
            "From: " + process.env.EMAIL_USER + "\nYour OTP is: " + otp + ". It is valid for 3 minutes."
        );
        
        res.json({
            success: true,
            message: "OTP sent to email",
        });

    } catch (error) {
        console.log("err for otp",error)
        res.status(500).json({ message: error.message });
    }
};
// @desc Validate OTP
// @route POST /api/auth/validate-otp
exports.validateOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const hashedOtp = crypto
            .createHash("sha256")
            .update(otp)
            .digest("hex");

        const record = await SessionOtp.findOne({
            email,
            otp: hashedOtp,
            otpExpire: { $gt: Date.now() },
        });

        if (!record) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        res.json({
            success: true,
            message: "OTP verified",
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc Reset Password via OTP
// @route POST /api/auth/reset-password
exports.resetPasswordWithOtp = async (req, res) => {
    try {
        const { email, otp, password } = req.body;

        const hashedOtp = crypto
            .createHash("sha256")
            .update(otp)
            .digest("hex");

        const record = await SessionOtp.findOne({
            email,
            otp: hashedOtp,
            otpExpire: { $gt: Date.now() },
        });

        if (!record) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        const user = await User.findOne({ email });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        await user.save();

        // delete OTP after success
        await SessionOtp.deleteMany({ email });

        res.json({
            success: true,
            message: "Password reset successful",
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};