import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  loginData = { email: '', password: '' };
  showPopup = false;

  constructor(private authService: AuthService, private router: Router) {}

  login() {
    this.authService.login(this.loginData.email, this.loginData.password).subscribe({
      next: (res) => {
        if (res.success) {
          this.authService.setCurrentUser(res.user);
          this.showPopup = true;
          setTimeout(() => {
            this.router.navigate(['/loan']); // ✅ redirect
          }, 1500);
        } else {
          alert('❌ ' + (res.message || 'Invalid email or password'));
        }
      },
      error: (err) => {
        alert('❌ ' + (err.error?.message || 'Login failed'));
      }
    });
  }
}
