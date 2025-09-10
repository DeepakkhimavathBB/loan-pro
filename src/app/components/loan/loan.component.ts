// src/app/components/loan/loan.component.ts
import { Component, OnInit } from '@angular/core';
import { LoanService } from '../../services/loan.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

type LoanStatus = 'Pending' | 'Under Review' | 'Approved' | 'Rejected' | 'Withdrawn' | 'Disbursed' | 'Closed';

@Component({
  selector: 'app-loan',
  templateUrl: './loan.component.html',
  styleUrls: ['./loan.component.css']
})
export class LoanComponent implements OnInit {
  // sidebar state
  activeTab: 'apply' | 'status' | 'repay' = 'apply';

  user: any;

  // form model
  loanForm = {
    type: '',
    amount: '',
    tenureYears: 1,
    paymentOption: 'emi', // 'emi' or 'full'
    purpose: '',
    documents: [] as string[]
  };

  // toast message
  toast = { type: 'success' as 'success' | 'error' | 'info', text: '' };

  myLoans: Array<any> = [];
  repayLoans: Array<any> = [];

  selectedFiles: File[] = [];
  fileNames: string[] = [];

  // for repay UI
  selectedLoanForDetails: any = null;
  lightboxImage: string | null = null; // for fullscreen docs

  // status steps
  statusSteps = ['Submitted','Under Review','Approved','Disbursed','Closed'];

  constructor(
    private loanService: LoanService,
    private auth: AuthService,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.user = this.auth.getCurrentUser();
    if (!this.user?.id) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadMyLoans();
  }

  setTab(tab: 'apply' | 'status' | 'repay') {
    this.activeTab = tab;
    this.loadMyLoans();
  }

  onFileChange(event: any) {
    const files: FileList = event.target.files;
    const newFiles = Array.from(files);
    this.selectedFiles = [...this.selectedFiles, ...newFiles].filter(
      (file, index, self) => index === self.findIndex(f => f.name === file.name)
    );
    this.fileNames = this.selectedFiles.map(f => f.name);
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
    this.fileNames.splice(index, 1);
  }

  applyLoan() {
    if (!this.loanForm.type || !this.loanForm.amount || !this.loanForm.purpose) {
      return this.showToast('error', 'Please fill all required fields.');
    }

    // upload files to Node file server (5000) - if not available, mock server returns []
    const formData = new FormData();
    this.selectedFiles.forEach(file => formData.append('files', file));

    this.http.post<any>('https://loan-api-1.onrender.com/upload', formData).subscribe({
      next: (res) => {
        const docUrls = (res?.files || []).map((f: any) => f.url);
        this.finishApply(docUrls);
      },
      error: () => {
        // fallback: if upload fails (no node server), continue with no docs
        this.finishApply([]);
      }
    });
  }

  private finishApply(docUrls: string[]) {
    const amountNum = Number(this.loanForm.amount);
    const tenureYears = Number(this.loanForm.tenureYears) || 1;
    const paymentOption = this.loanForm.paymentOption || 'emi';
    const months = paymentOption === 'full' ? 1 : (tenureYears * 12);
    const monthlyInstallment = months > 0 ? Math.ceil(amountNum / months) : amountNum;

    const payload: any = {
      loanId: Date.now(),
      userId: Number(this.user.id),
      applicantName: this.user.name,
      applicantEmail: this.user.email,
      type: this.loanForm.type,
      amount: amountNum,
      tenureYears,
      repaymentMonths: months,
      paymentOption,
      monthlyInstallment,
      totalPaid: 0,
      repayments: [],
      purpose: this.loanForm.purpose,
      documents: docUrls,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };

    this.loanService.addLoan(payload).subscribe({
      next: () => {
        this.showToast('success', 'Loan applied successfully ✅');
        // reset
        this.loanForm = { type: '', amount: '', tenureYears: 1, paymentOption: 'emi', purpose: '', documents: [] };
        this.selectedFiles = [];
        this.fileNames = [];
        this.loadMyLoans();
        this.activeTab = 'status';
      },
      error: () => this.showToast('error', 'Something went wrong while saving loan.')
    });
  }

  loadMyLoans() {
    this.loanService.getLoansByUser(this.user.id).subscribe({
      next: (loans) => {
        this.myLoans = (loans || [])
          .map(l => {
            // auto-disburse immediately if status is "Approved"
            if (l.status === 'Approved') l.status = 'Disbursed';
            return { ...l, createdAt: l.createdAt || new Date().toISOString() };
          })
          .sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));

        this.repayLoans = this.myLoans.filter(l => ['Approved','Disbursed','Closed'].includes(l.status));
      },
      error: () => this.showToast('error','Could not load your loans.')
    });
    
  }
  




  withdraw(loan: any) {
    const id = this.resolveLoanId(loan);
    if (loan.status !== 'Pending') {
      return this.showToast('info', 'Only pending applications can be withdrawn.');
    }
    this.loanService.withdrawLoan(id, { status: 'Withdrawn' }).subscribe({
      next: () => {
        this.showToast('success', `Loan #${loan.loanId || id} withdrawn.`);
        this.loadMyLoans();
      },
      error: () => this.showToast('error', 'Failed to withdraw loan.')
    });
  }

  // --- Repayment UI methods ---

  openLoanDetails(loan: any) {
    this.selectedLoanForDetails = loan;
  }

  closeLoanDetails() {
    this.selectedLoanForDetails = null;
  }

  payMonthly(loan: any) {
    const id = this.resolveLoanId(loan);
    if (loan.status === 'Closed') return this.showToast('info','Loan already closed.');
    this.loanService.payLoan(id, { type: 'monthly' }).subscribe({
      next: (updated) => {
        this.showToast('success', 'Monthly payment received.');
        this.updateLoanInList(updated);
      },
      error: () => this.showToast('error', 'Payment failed.')
    });
  }

  payFull(loan: any) {
    const id = this.resolveLoanId(loan);
    const balance = (loan.amount || 0) - (loan.totalPaid || 0);
    if (loan.status === 'Closed') return this.showToast('info','Loan already closed.');
    this.loanService.payLoan(id, { type: 'full', amount: balance }).subscribe({
      next: (updated) => {
        this.showToast('success', 'Full payment received. Loan closed.');
        this.updateLoanInList(updated);
      },
      error: () => this.showToast('error', 'Full payment failed.')
    });
  }

  payCustom(loan: any, amountInput: string) {
    const id = this.resolveLoanId(loan);
    const amt = Number(amountInput);
    if (!amt || amt <= 0) {
      return this.showToast('error', 'Enter a valid amount.');
    }

    this.loanService.payLoan(id, { type: 'custom', amount: amt }).subscribe({
      next: (updated) => {
        this.showToast('success', `Payment of ₹${amt} received.`);
        this.updateLoanInList(updated);
      },
      error: () => this.showToast('error', 'Payment failed.')
    });
  }

  // helper: update single loan in UI list
  private updateLoanInList(updated: any) {
    const id = this.resolveLoanId(updated);
    const index = this.myLoans.findIndex(l => this.resolveLoanId(l) === id);
    if (index > -1) this.myLoans[index] = updated;
    // refresh repay list
    this.repayLoans = this.myLoans.filter(l => l.status === 'Approved' || l.status === 'Closed' || l.status === 'Disbursed');
    this.selectedLoanForDetails = updated;
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  private showToast(type: 'success'|'error'|'info', text: string) {
    this.toast = { type, text };
    setTimeout(() => (this.toast.text = ''), 3000);
  }

  getStatusProgress(status: string): number {
    switch (status) {
      case 'Pending': return 10;
      case 'Under Review': return 30;
      case 'Approved': return 60;
      case 'Disbursed': return 85;
      case 'Closed': return 100;
      case 'Rejected': return 100;
      default: return 0;
    }
  }

  // UI helpers
  badgeClass(status: string) {
    switch (status) {
      case 'Pending': return 'badge-pending';
      case 'Approved': return 'badge-approved';
      case 'Rejected': return 'badge-rejected';
      case 'Withdrawn': return 'badge-withdrawn';
      case 'Closed': return 'badge-approved';
      default: return '';
    }
  }

  // Accept many id shapes
  resolveLoanId(loan: any) {
    return loan.id || loan._id || loan.loanId || loan.loan_id || null;
  }

  isImage(url: string) {
    if (!url) return false;
    return /\.(jpg|jpeg|png|gif|bmp|webp)(\?|$)/i.test(url);
  }

  // step active logic: mark steps up to matching status
  isStepActive(status: string, idx: number) {
    const map: any = { 'Pending': 0, 'Under Review': 1, 'Approved': 2, 'Disbursed': 3, 'Closed': 4, 'Rejected': 4 };
    const pos = map[status] ?? 0;
    return idx <= pos;
  }
  
}
