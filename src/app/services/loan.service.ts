// src/app/services/loan.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type RepaymentType = 'monthly' | 'full' | 'custom';

@Injectable({ providedIn: 'root' })
export class LoanService {
  private loansUrl = `${environment.loansApi}/loans`;

  constructor(private http: HttpClient) {}

  addLoan(loan: any): Observable<any> {
    return this.http.post(this.loansUrl, loan);
  }

  getLoansByUser(userId: number | string): Observable<any[]> {
    return this.http.get<any[]>(`${this.loansUrl}/user/${userId}`);
  }

  withdrawLoan(id: string, patch: Partial<any>): Observable<any> {
    return this.http.patch(`${this.loansUrl}/${id}`, patch);
  }

  getAllLoans(): Observable<any[]> {
    return this.http.get<any[]>(this.loansUrl);
  }

  updateLoanStatus(loanId: string, status: string): Observable<any> {
    return this.http.patch(`${this.loansUrl}/${loanId}`, { status });
  }

  getLoanById(id: string): Observable<any> {
    return this.http.get<any>(`${this.loansUrl}/${id}`);
  }

  // ✅ Repayment (monthly, full, custom)
  payLoan(
    id: string,
    payload: { type: RepaymentType; amount?: number }
  ): Observable<any> {
    return this.http.post<any>(`${this.loansUrl}/${id}/pay`, payload);
  }
}
