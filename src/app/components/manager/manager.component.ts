import { Component, OnInit, AfterViewInit, AfterViewChecked, OnDestroy, ElementRef, QueryList, ViewChildren } from '@angular/core';
import { LoanService } from '../../services/loan.service';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Chart, ChartType, registerables } from 'chart.js';

Chart.register(...registerables);

type LoanStatus = 'Pending' | 'Approved' | 'Rejected' | 'Withdrawn' | 'Closed' | '';

@Component({
  selector: 'app-manager',
  templateUrl: './manager.component.html',
  styleUrls: ['./manager.component.css']
})
export class ManagerComponent implements OnInit, AfterViewInit, AfterViewChecked, OnDestroy {
  loans: any[] = [];
  searchTerm = '';
  statusFilter: LoanStatus = '';
  minAmount?: number;
  maxAmount?: number;
  stats = { approved: 0, pending: 0, rejected: 0, withdrawn: 0, closed: 0 };
  toast = { type: 'success' as 'success' | 'error' | 'info', text: '' };

  // modal selection for payments
  selectedLoanPayments: any = null;

  // image viewer
  selectedImage: string | null = null;

  // Chart canvas references created by *ngFor via #loanChart
  @ViewChildren('loanChart', { read: ElementRef }) loanCharts!: QueryList<ElementRef<HTMLCanvasElement>>;

  // store chart instances to destroy when needed
  private chartInstances: Chart[] = [];

  constructor(private loanService: LoanService, private http: HttpClient) {}

  ngOnInit(): void {
    this.loadLoans();
  }

  ngAfterViewInit(): void {
    // re-render charts when the set of canvases changes (e.g. filters or loans changed)
    this.loanCharts.changes.subscribe(() => this.renderCharts());
    // initial render attempt
    this.renderCharts();
  }

  ngAfterViewChecked(): void {
    // safe-render after change detection
    // (renderCharts itself is idempotent — it destroys previous charts and re-creates)
    // small throttle via setTimeout to let layout happen
  }

  ngOnDestroy(): void {
    this.destroyAllCharts();
  }

  loadLoans(): void {
    this.loanService.getAllLoans().subscribe({
      next: (data) => {
        this.loans = (data || []).sort((a, b) =>
          (b.createdAt || '').localeCompare(a.createdAt || '')
        );
        this.computeStats();
        // ensure charts are rendered after loans updated and view refreshed
        setTimeout(() => this.renderCharts(), 50);
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
      withdrawn: by('Withdrawn'),
      closed: by('Closed')
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
            this.http.post(`${environment.usersApi}/notify-loan-status`, payload).subscribe({
              next: () => this.showToast('success', `Loan #${loan.loanId} set to ${status}. Email sent.`),
              error: () => this.showToast('error', 'Status updated, but failed to send email.')
            });

            if (status === 'Closed') {
              const congratsPayload = {
                email: payload.email,
                name: payload.name,
                loanId: loan.loanId
              };
              this.http.post(`${environment.usersApi}/notify-loan-closed`, congratsPayload).subscribe({
                next: () => console.log('Congrats email triggered'),
                error: () => console.warn('Failed to trigger congrats email')
              });
            }
          },
          error: () => this.showToast('error', 'Status updated, but failed to fetch user email.')
        });
      },
      error: () => this.showToast('error', 'Failed to update status.')
    });
  }

  openPaymentsModal(loan: any): void {
    this.selectedLoanPayments = loan;
  }
  closePaymentsModal(): void {
    this.selectedLoanPayments = null;
  }

  getRepaymentPercent(loan: any): number {
    if (!loan.repayments || loan.repayments.length === 0 || !loan.amount) {
      return 0;
    }
    const paid = loan.repayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    return Math.min(100, Math.round((paid / Number(loan.amount || 0)) * 100));
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
    if (!el) return this.showToast('info', 'Nothing to export.');

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

  isImage(fileUrl: string): boolean {
    if (!fileUrl) return false;
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl.toLowerCase());
  }

  // ---------------- Chart handling ----------------

  private destroyAllCharts() {
    this.chartInstances.forEach(c => {
      try { c.destroy(); } catch { /* ignore */ }
    });
    this.chartInstances = [];
  }

  private renderCharts() {
    // Wait a frame so canvases exist & have size
    setTimeout(() => {
      // destroy previous charts first
      this.destroyAllCharts();

      const canvases = this.loanCharts.toArray();
      const loans = this.getFilteredLoans();

      canvases.forEach((canvasRef, idx) => {
        const loan = loans[idx];
        if (!loan) return;

        const canvasEl = canvasRef.nativeElement;
        // ensure canvas has a context
        const ctx = canvasEl.getContext ? canvasEl.getContext('2d') : null;
        if (!ctx) return;

        // compute data
        const total = Number(loan.amount) || 1;
        const paid = (loan.repayments || []).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        const remaining = Math.max(total - paid, 0);

        // create chart
        const chart = new Chart(canvasEl, {
          type: 'pie' as ChartType,
          data: {
            labels: ['Paid', 'Remaining'],
            datasets: [{
              data: [paid, remaining],
              backgroundColor: ['#10b981', '#e6eef9'],
              borderWidth: 0
            }]
          },
          options: {
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                callbacks: {
                  label: (ctx) => {
                    const v = ctx.parsed;
                    return `${ctx.label}: ₹${Number(v).toLocaleString()}`;
                  }
                }
              }
            },
            maintainAspectRatio: false,
            responsive: true
          }
        });

        // keep instance
        this.chartInstances.push(chart);
      });
    }, 40);
  }

  // ---------------- Image viewer ----------------
  openImage(img: string) {
    this.selectedImage = img;
    // small delay to allow modal CSS animations
    setTimeout(() => {
      // prevent background scroll when open
      document.body.style.overflow = 'hidden';
    }, 0);
  }

  closeImage() {
    this.selectedImage = null;
    document.body.style.overflow = '';
  }
}
