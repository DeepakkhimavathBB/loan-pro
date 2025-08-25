import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { AboutComponent } from './components/about/about.component';
import { RegisterComponent } from './components/register/register.component';
import { LoginComponent } from './components/login/login.component';
import { LoanComponent } from './components/loan/loan.component';
import { ManagerComponent } from './components/manager/manager.component';
import { Login2Component } from './components/login2/login2.component';
import { ManagerAuthGuard } from './guards/manager-auth.guard';

const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'about', component: AboutComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'login', component: LoginComponent },
  { path: 'loan', component: LoanComponent },

  // 🔒 Manager Routes
  { path: 'manager', component: ManagerComponent, canActivate: [ManagerAuthGuard] },
  { path: 'manager-login', component: Login2Component },

  // Wildcard (always last)
  { path: '**', redirectTo: '/home' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule]
})
export class AppRoutingModule {}
