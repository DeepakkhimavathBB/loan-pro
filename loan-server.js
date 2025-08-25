// loan-server.js

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const { v4: uuidv4 } = require('uuid');

// 📂 Setup DB (loan.json)
const adapter = new FileSync('loan.json');
const db = low(adapter);

// default structure
db.defaults({ loans: [] }).write();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 📌 Nodemailer setup (use your Gmail + App Password here)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'deepakkhimavath@gmail.com',   // your gmail
    pass: 'kpfo lqhr cral jnkr'          // Gmail app password
  }
});

// ✅ Get all loans
app.get('/loans', (req, res) => {
  res.json(db.get('loans').value());
});

// ✅ Get loans by userId
app.get('/loans/user/:userId', (req, res) => {
  const loans = db.get('loans').filter({ userId: req.params.userId }).value();
  res.json(loans);
});

// ✅ Add new loan
app.post('/loans', (req, res) => {
  const loan = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    ...req.body
  };
  db.get('loans').push(loan).write();
  res.status(201).json(loan);
});

// ✅ Update loan status (approval/reject/withdraw)
app.patch('/loans/:id', (req, res) => {
  const loan = db.get('loans').find({ id: req.params.id }).value();
  if (!loan) return res.status(404).json({ error: 'Loan not found' });

  db.get('loans').find({ id: req.params.id }).assign(req.body).write();
  const updatedLoan = db.get('loans').find({ id: req.params.id }).value();

  // 🔔 Send email based on status
  if (req.body.status) {
    let subject = '';
    let html = '';

    if (req.body.status === 'Approved') {
      subject = '🎉 Congratulations! Your Loan is Approved';
      html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border-radius:10px;background:#f9f9f9;">
          <h2 style="color:#28a745;">✅ Loan Approved</h2>
          <p>Dear <b>${loan.applicantName}</b>,</p>
          <p>We are thrilled to inform you that your <b>${loan.type}</b> has been <span style="color:green;font-weight:bold;">APPROVED</span>!</p>
          <p><b>Loan ID:</b> ${loan.id}<br/>
             <b>Loan Type:</b> ${loan.type}<br/>
             <b>Amount:</b> ₹${loan.amount}<br/>
             <b>Tenure:</b> ${loan.tenure}</p>
          <p style="margin-top:20px;">We sincerely appreciate your trust in us. Our team is here to support you at every step.</p>
          <p style="color:#555;">Warm Regards,<br/>Loan Team</p>
        </div>`;
    } 
    else if (req.body.status === 'Rejected') {
      subject = '❌ Loan Application Result';
      html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border-radius:10px;background:#fff3f3;">
          <h2 style="color:#dc3545;">❌ Loan Rejected</h2>
          <p>Dear <b>${loan.applicantName}</b>,</p>
          <p>We regret to inform you that your <b>${loan.type}</b> request (Loan ID: ${loan.id}) has been <span style="color:red;font-weight:bold;">REJECTED</span>.</p>
          <p>Please don’t be discouraged — you may reapply after a few months once your profile meets the eligibility criteria.</p>
          <p style="margin-top:20px;color:#555;">Thank you for considering us.<br/>Loan Team</p>
        </div>`;
    } 
    else if (req.body.status === 'Withdrawn') {
      subject = 'ℹ️ Loan Request Withdrawn';
      html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border-radius:10px;background:#e8f4fd;">
          <h2 style="color:#007bff;">ℹ️ Loan Withdrawn</h2>
          <p>Dear <b>${loan.applicantName}</b>,</p>
          <p>Your <b>${loan.type}</b> request (Loan ID: ${loan.id}) has been successfully withdrawn.</p>
          <p>If you wish, you can reapply anytime in the future — we’ll be happy to assist you.</p>
          <p style="margin-top:20px;color:#555;">Warm Regards,<br/>Loan Team</p>
        </div>`;
    }

    if (subject && html) {
      const mailOptions = {
        from: 'deepakkhimavath@gmail.com',
        to: loan.applicantEmail || 'khimavathdeepak@gmail.com',
        subject,
        html
      };

      transporter.sendMail(mailOptions, (err, info) => {
        if (err) console.error('Mail error:', err);
        else console.log('📧 Mail sent:', info.response);
      });
    }
  }

  res.json(updatedLoan);
});

// ✅ Delete loan
app.delete('/loans/:id', (req, res) => {
  db.get('loans').remove({ id: req.params.id }).write();
  res.status(204).send();
});

// 🚀 Start server
app.listen(3001, () => console.log('🚀 Loan API running on http://localhost:3001'));
