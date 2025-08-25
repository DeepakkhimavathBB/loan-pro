import { Component, OnInit } from '@angular/core';
import { LoanService } from '../../services/loan.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

type LoanStatus = 'Pending' | 'Approved' | 'Rejected' | 'Withdrawn';

@Component({
  selector: 'app-loan',
  templateUrl: './loan.component.html',
  styleUrls: ['./loan.component.css']
})
export class LoanComponent implements OnInit {
  // sidebar state
  activeTab: 'apply' | 'status' = 'apply';

  // current user
  user: any;

  // form model
  loanForm = {
    type: '',
    amount: '',
    tenure: '',
    purpose: '',
    documents: [] as string[]
  };

  // messages
  toast = { type: 'success' as 'success' | 'error' | 'info', text: '' };

  // user’s loans
  myLoans: Array<any> = [];

  // files
  selectedFiles: File[] = [];
  fileNames: string[] = [];

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

  setTab(tab: 'apply' | 'status') {
    this.activeTab = tab;
    if (tab === 'status') this.loadMyLoans();
  }

  // ✅ handle MULTIPLE file selection
  onFileChange(event: any) {
    const files: FileList = event.target.files;
    const newFiles = Array.from(files);

    // merge + filter duplicates by file.name
    this.selectedFiles = [...this.selectedFiles, ...newFiles].filter(
      (file, index, self) => index === self.findIndex(f => f.name === file.name)
    );

    this.fileNames = this.selectedFiles.map(f => f.name);
  }

  // ✅ remove file from selection
  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
    this.fileNames.splice(index, 1);
  }

  applyLoan() {
    if (!this.loanForm.type || !this.loanForm.amount || !this.loanForm.tenure || !this.loanForm.purpose) {
      return this.showToast('error', 'Please fill all fields.');
    }

    // Upload files to Node (PORT 5000)
    const formData = new FormData();
    this.selectedFiles.forEach(file => formData.append('files', file));

    this.http.post<any>('http://localhost:5000/upload', formData).subscribe({
      next: (res) => {
        const docUrls = (res?.files || []).map((f: any) => f.url);

        const payload = {
          loanId: Date.now(),
          userId: this.user.id,
          applicantName: this.user.name,
          applicantEmail: this.user.email,   // ✅ Added email for notifications
          type: this.loanForm.type,
          amount: +this.loanForm.amount,
          tenure: this.loanForm.tenure,
          purpose: this.loanForm.purpose,
          documents: docUrls,
          status: 'Pending' as LoanStatus,
          createdAt: new Date().toISOString()
        };

        this.loanService.addLoan(payload).subscribe({
          next: () => {
            this.showToast('success', 'Loan applied successfully ✅');
            this.loanForm = { type: '', amount: '', tenure: '', purpose: '', documents: [] };
            this.selectedFiles = [];
            this.fileNames = [];
            this.loadMyLoans();
            this.activeTab = 'status';
          },
          error: () => this.showToast('error', 'Something went wrong while saving loan.')
        });
      },
      error: () => this.showToast('error', 'File upload failed. Please try again.')
    });
  }

  loadMyLoans() {
    this.loanService.getLoansByUser(this.user.id).subscribe({
      next: (loans) =>
        (this.myLoans = loans.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))),
      error: () => this.showToast('error', 'Could not load your loans.')
    });
  }

  withdraw(loan: any) {
    if (loan.status !== 'Pending') {
      return this.showToast('info', 'Only pending applications can be withdrawn.');
    }
    this.loanService.withdrawLoan(loan.id, { status: 'Withdrawn' }).subscribe({
      next: () => {
        this.showToast('success', `Loan #${loan.loanId} withdrawn.`);
        this.loadMyLoans();
      },
      error: () => this.showToast('error', 'Failed to withdraw loan.')
    });
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  private showToast(type: 'success' | 'error' | 'info', text: string) {
    this.toast = { type, text };
    setTimeout(() => (this.toast.text = ''), 3000);
  }
}
