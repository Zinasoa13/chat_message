import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar.html',
  styleUrls: ['./calendar.css']
})
export class Calendar implements OnInit {
  currentDate = new Date();
  today = new Date();
  
  daysInMonth: number[] = [];
  monthName: string = '';
  year: number = 0;
  firstDayOfMonth: number = 0;
  
  daysOfWeek = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  ngOnInit() {
    this.generateCalendar();
  }

  generateCalendar() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    this.year = year;
    this.monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(this.currentDate);
    
    const firstDay = new Date(year, month, 1).getDay();
    // Ajuster car getDay() commence par Dimanche (0), on veut Lundi (1)
    this.firstDayOfMonth = firstDay === 0 ? 6 : firstDay - 1;
    
    const lastDay = new Date(year, month + 1, 0).getDate();
    this.daysInMonth = Array.from({ length: lastDay }, (_, i) => i + 1);
  }

  isToday(day: number): boolean {
    return day === this.today.getDate() && 
           this.currentDate.getMonth() === this.today.getMonth() && 
           this.currentDate.getFullYear() === this.today.getFullYear();
  }

  nextMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.generateCalendar();
  }

  prevMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.generateCalendar();
  }

  goToToday() {
    this.currentDate = new Date();
    this.generateCalendar();
  }
}
