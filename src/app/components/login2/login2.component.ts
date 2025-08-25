import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login2',
  templateUrl: './login2.component.html',
  styleUrls: ['./login2.component.css']
})
export class Login2Component {
  username: string = '';
  password: string = '';
  errorMessage: string = '';

  private managerUrl = `${environment.managerApi}/managers`;

  constructor(private http: HttpClient, private router: Router) {}

  onLogin() {
    this.http
      .get<any[]>(`${this.managerUrl}?username=${this.username}&password=${this.password}`)
      .subscribe(users => {
        if (users.length > 0) {
          // ✅ Use sessionStorage so it expires after browser is closed
          sessionStorage.setItem('managerLoggedIn', 'true');
          this.router.navigate(['/manager']);
        } else {
          this.errorMessage = '❌ Invalid username or password';
        }
      });
  }
  
  onLogout() {
    sessionStorage.removeItem('managerLoggedIn');
    this.router.navigate(['/manager-login']);
  }
  
}
