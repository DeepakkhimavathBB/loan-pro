import { Component, OnInit } from '@angular/core';
import { LoanService } from '../../services/loan.service';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

type LoanStatus = 'Pending' | 'Approved' | 'Rejected' | 'Withdrawn' | '';

@Component({
  selector: 'app-manager',
  templateUrl: './manager.component.html',
  styleUrls: ['./manager.component.css']
})
export class ManagerComponent implements OnInit {
  loans: any[] = [];
  searchTerm = '';
  statusFilter: LoanStatus = '';
  minAmount?: number;
  maxAmount?: number;
  stats = { approved: 0, pending: 0, rejected: 0, withdrawn: 0 };
  toast = { type: 'success' as 'success' | 'error' | 'info', text: '' };

  constructor(private loanService: LoanService, private http: HttpClient) {}

  ngOnInit(): void {
    this.loadLoans();
  }

  loadLoans(): void {
    this.loanService.getAllLoans().subscribe({
      next: (data) => {
        this.loans = (data || []).sort((a, b) =>
          (b.createdAt || '').localeCompare(a.createdAt || '')
        );
        this.computeStats();
      },
      error: () => this.showToast('error', 'Failed to load loans.')
    });
  }

  computeStats(): void {
    const by = (s: string) => this.loans.filter(l => l.status === s).length;
    this.stats = {
      approved: by('Approved'),
      pending: by('Pending'),
      rejected: by('Rejected'),
      withdrawn: by('Withdrawn')
    };
  }

  getFilteredLoans(): any[] {
    let rows = [...this.loans];
    const q = this.searchTerm.trim().toLowerCase();
    if (q) {
      rows = rows.filter(l =>
        [
          String(l.loanId ?? '').toLowerCase(),
          String(l.userId ?? '').toLowerCase(),
          String(l.applicantName ?? '').toLowerCase(),
          String(l.type ?? '').toLowerCase(),
          String(l.purpose ?? '').toLowerCase()
        ].some(v => v.includes(q))
      );
    }
    if (this.statusFilter) rows = rows.filter(l => l.status === this.statusFilter);
    if (this.minAmount != null) rows = rows.filter(l => +l.amount >= +this.minAmount!);
    if (this.maxAmount != null) rows = rows.filter(l => +l.amount <= +this.maxAmount!);
    return rows;
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.statusFilter = '';
    this.minAmount = undefined;
    this.maxAmount = undefined;
  }

  updateStatus(loan: any, status: Exclude<LoanStatus, ''>): void {
    this.loanService.updateLoanStatus(loan.id, status).subscribe({
      next: () => {
        loan.status = status;
        this.computeStats();
        // 1) get user's email from Users API (3002)
        this.http.get<any>(`${environment.usersApi}/users/${loan.userId}`).subscribe({
          next: (user) => {
            const payload = {
              email: user?.email,
              name: user?.name || loan.applicantName,
              loanId: loan.loanId,
              status
            };
            if (!payload.email) {
              this.showToast('info', `Status updated. No email on file for userId ${loan.userId}.`);
              return;
            }
            // 2) ask Node server (3002) to send the email
            this.http.post(`${environment.usersApi}/notify-loan-status`, payload).subscribe({
              next: () => this.showToast('success', `Loan #${loan.loanId} set to ${status}. Email sent to ${payload.email}`),
              error: () => this.showToast('error', 'Status updated, but failed to send email.')
            });
          },
          error: () => this.showToast('error', 'Status updated, but failed to fetch user email.')
        });
      },
      error: () => this.showToast('error', 'Failed to update status.')
    });
  }

  exportCSV(): void {
    const rows = this.getFilteredLoans();
    if (!rows.length) return this.showToast('info', 'No data to export.');

    const headers = [
      'loanId','id','userId','applicantName','type','amount','tenure',
      'purpose','status','createdAt','documentsCount'
    ];
    const csv = [
      headers.join(','),
      ...rows.map(r => [
        r.loanId, r.id, r.userId, this.csvSafe(r.applicantName), r.type, r.amount,
        this.csvSafe(r.tenure), this.csvSafe(r.purpose), r.status, r.createdAt,
        (r.documents?.length || 0)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, 'loans.csv');
  }

  private csvSafe(v: any): string {
    const s = String(v ?? '');
    return `"${s.replace(/"/g, '""')}"`;
  }

  async exportPDF(): Promise<void> {
    const el = document.getElementById('loansTable');
    if (!el) return;

    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: 'a4' });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const imgW = pageW - 32;
      const imgH = canvas.height * (imgW / canvas.width);

      let y = 16;
      pdf.addImage(imgData, 'PNG', 16, y, imgW, imgH);

      let remaining = imgH - (pageH - 32);
      while (remaining > 0) {
        pdf.addPage();
        y = 16 - (imgH - remaining);
        pdf.addImage(imgData, 'PNG', 16, y, imgW, imgH);
        remaining -= pageH;
      }

      pdf.save('loans.pdf');
    } catch {
      this.showToast('error', 'Failed to export PDF.');
    }
  }

  private showToast(type: 'success'|'error'|'info', text: string) {
    this.toast = { type, text };
    setTimeout(() => (this.toast.text = ''), 2500);
  }
}
