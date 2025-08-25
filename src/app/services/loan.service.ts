import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class LoanService {
  private loansUrl = `${environment.loansApi}/loans`;

  constructor(private http: HttpClient) {}

  // create loan (attach userId + loanId in component before calling)
  addLoan(loan: any): Observable<any> {
    return this.http.post(this.loansUrl, loan); // json-server will also assign id
  }

  // list loans for a user
  getLoansByUser(userId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.loansUrl}?userId=${userId}`);
  }

  // withdraw = update status to "Withdrawn"
  withdrawLoan(id: number, patch: Partial<any>): Observable<any> {
    return this.http.patch(`${this.loansUrl}/${id}`, patch);
  }

    // ✅ Get all loans
    getAllLoans(): Observable<any[]> {
      return this.http.get<any[]>(this.loansUrl);
    }
  
    // ✅ Update loan status
    updateLoanStatus(loanId: number, status: string): Observable<any> {
      return this.http.patch(`${this.loansUrl}/${loanId}`, { status });
    }
}
