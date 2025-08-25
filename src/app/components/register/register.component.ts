import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  user = { name: '', email: '', password: '', phone: '' };
  showPopup = false;

  constructor(private authService: AuthService) {}

  register() {
    this.authService.register(this.user).subscribe({
      next: (res: any) => {
        if(res.success) {
          this.showPopup = true;
          this.user = { name: '', email: '', password: '', phone: '' };
          setTimeout(() => { this.showPopup = false; }, 2000);
        }
      },
      error: (err) => {
        console.error('Registration failed', err);
        let message = 'Registration failed! Try again.';
        if(err.error?.message) message = err.error.message;
        alert(message); // or show a styled popup
      }
    });
  }
  
  
}
