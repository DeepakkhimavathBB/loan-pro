import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class ManagerAuthGuard implements CanActivate {

  constructor(private router: Router) {}

  canActivate(): boolean {
    const isLoggedIn = sessionStorage.getItem('managerLoggedIn'); // 🔒 sessionStorage instead of localStorage

    if (isLoggedIn === 'true') {
      return true; // allow access
    }

    // not logged in → go to manager login
    this.router.navigate(['/manager-login']);
    return false;
  }
}
