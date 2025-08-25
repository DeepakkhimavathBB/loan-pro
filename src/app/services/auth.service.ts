import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private usersUrl = `${environment.usersApi}/users`;
  private loginUrl = `${environment.usersApi}/login`;

  constructor(private http: HttpClient) {}

  // Register new user
  register(user: any): Observable<any> {
    return this.http.post(this.usersUrl, user);
  }

  // Login → calls backend /login
  login(email: string, password: string): Observable<any> {
    return this.http.post(this.loginUrl, { email, password });
  }

  // Simple session helpers
  setCurrentUser(user: any) {
    localStorage.setItem('currentUser', JSON.stringify(user));
  }

  getCurrentUser() {
    const raw = localStorage.getItem('currentUser');
    return raw ? JSON.parse(raw) : null;
  }

  logout() {
    localStorage.removeItem('currentUser');
  }
}
