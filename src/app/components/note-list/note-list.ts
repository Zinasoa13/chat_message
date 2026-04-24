import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../services/data.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-note-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="view-container">
      <div class="view-header">
        <span class="material-icons-rounded">note_alt</span>
        <h2>Mes Notes</h2>
      </div>
      
      <div class="add-note">
        <input [(ngModel)]="newNote" placeholder="Ajouter une tâche..." (keyup.enter)="addNote()">
        <button (click)="addNote()">
          <span class="material-icons-rounded">add</span>
        </button>
      </div>

      <div class="notes-grid custom-scrollbar">
        <div class="note-card" *ngFor="let note of notes">
          <div class="note-header">
            <span class="date">{{note.createdAt | date:'short'}}</span>
            <button class="delete-btn" (click)="deleteNote(note._id)">
              <span class="material-icons-rounded">delete</span>
            </button>
          </div>
          <div class="note-content">{{note.content}}</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .view-container { padding: 2rem; height: 100%; display: flex; flex-direction: column; }
    .view-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; }
    .view-header h2 { font-weight: 800; font-size: 1.5rem; }
    .view-header .material-icons-rounded { font-size: 2rem; color: var(--chat-primary); }
    
    .add-note { display: flex; gap: 1rem; margin-bottom: 2rem; background: white; padding: 0.5rem; border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
    .add-note input { flex: 1; border: none; padding: 0.8rem; outline: none; font-size: 1rem; }
    .add-note button { background: var(--chat-primary); color: white; border: none; width: 42px; height: 42px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; }

    .notes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; overflow-y: auto; padding-bottom: 2rem; }
    .note-card { background: white; padding: 1.5rem; border-radius: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.02); transition: all 0.2s; position: relative; }
    .note-card:hover { transform: translateY(-5px); box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
    
    .note-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem; }
    .date { font-size: 0.75rem; color: #9ca3af; font-weight: 600; }
    
    .delete-btn { background: transparent; border: none; color: #9ca3af; cursor: pointer; padding: 4px; border-radius: 8px; transition: all 0.2s; visibility: hidden; opacity: 0; }
    .note-card:hover .delete-btn { visibility: visible; opacity: 1; }
    .delete-btn:hover { background: #fee2e2; color: #ef4444; }
    .delete-btn .material-icons-rounded { font-size: 18px; }

    .note-content { font-size: 1rem; line-height: 1.6; color: #374151; white-space: pre-wrap; }
  `]
})
export class NoteList implements OnInit {
  notes: any[] = [];
  newNote = '';

  constructor(
    private dataService: DataService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.dataService.getNotes().subscribe(notes => {
      this.notes = notes;
      this.cdr.detectChanges();
    });
  }

  addNote() {
    if (!this.newNote.trim()) return;
    this.dataService.createNote(this.newNote, 'Ma Note').subscribe(note => {
      this.notes = [note, ...this.notes];
      this.newNote = '';
      this.cdr.detectChanges();
    });
  }

  deleteNote(id: string) {
    this.dataService.deleteNote(id).subscribe(() => {
      this.notes = this.notes.filter(n => n._id !== id);
      this.cdr.detectChanges();
    });
  }
}
