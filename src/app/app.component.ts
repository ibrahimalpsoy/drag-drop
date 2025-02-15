import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { NgSelectModule } from '@ng-select/ng-select';
import { BehaviorSubject, delay } from 'rxjs';

/** Sürüklenebilir elemanları temsil eden model */
class DragElement {
  type: string;  // elementin türü (input, select, radio, checkbox)
  label: string; // Elemanın ekranda görünen label ı
}

/** Tablo içerisindeki hücrelerin yapısını belirten model */
class TableCell {
  row: number; // Satır numarası
  col: number; // Sütun numarası
  element: DragElement; // Hücrede bulunan form elemanı
  value: any; // elementin verisi
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DragDropModule, NgSelectModule],
  styleUrls: ['./app.component.css']
})

export class AppComponent implements OnInit {

  /** tablo içeriğinin değişimlerini anlık olarak takip etmek ve bileşene otomatik olarak yansıtmak için kullanılıyor. 
   * Tabloya yeni bir eleman eklendiğinde veya bir eleman kaldırıldığında, 
   * BehaviorSubject güncellenmiş tablo verisini yayarak bileşenin bu değişiklikleri algılamasını sağlıyor. 
   * Yani bi elementi sildiğimde yapulan bu değişikliği algılıyor.
   * Bu sayede manuel olarak tabloyu güncellemek yerine, değişiklikler otomatik olarak bileşene yansıtılıyor. 
   * Ayrıca, tableData$ üzerinden asenkron olarak veriye abone olunarak, herhangi bir güncelleme anında bileşende görüntülenebiliyor
   * Farklı bir yöntem denenebilr. */
  private tableDataSubject = new BehaviorSubject<(DragElement | null)[][]>([]);
  tableData$ = this.tableDataSubject.asObservable();

  form: FormGroup;

  /** Sürüklenebilir form elemanları */
  dragElements: DragElement[] = [
    { type: 'input', label: 'Input' },
    { type: 'select', label: 'Dropdown' },
    { type: 'radio', label: 'Radio' },
    { type: 'checkbox', label: 'Checkbox' }
  ];

  /** Dropdown için geçici veri listesi */
  dropdownData = [
    { id: 1, name: 'Seçenek 1' },
    { id: 2, name: 'Seçenek 2' },
    { id: 3, name: 'Seçenek 3' }
  ];

  /** 5x5 boş tablo oluşturuluyor */
  tableData: (DragElement | null)[][] = Array(5).fill(null).map(() => Array(5).fill(null));
  savedData: TableCell[] = []; // Kullanıcı girdilerini saklayan dizi

  isDragging = false;  // Sürükleme işlemi başladı mı?
  isButtonVisible = false; // API'ye gönder butonu görünecek mi?
  isTableVisible = false; // Tablo başlangıçta görünmeyecek

  constructor(private fb: FormBuilder) { }

  ngOnInit() {
    this.initializeForm();
    // Sayfa açıldığında tabloyu gizle
    this.hideTableBorders();
    this.isTableVisible = false;
  }

  initializeForm() {
    this.form = this.fb.group({});
  }

  /** Tablonun görünürlüğünü ayarla */
  hideTableBorders() {
    this.isDragging = false;
    this.isButtonVisible = false;
    this.isTableVisible = false;
  }

  /** Tablonun üzerine gelindiğinde border değişimi */
  onDragEnter() {
    this.isDragging = true;
    this.isTableVisible = true;
  }

  /** Tablodan çıkıldığında borderı eski haline döndür */
  onDragLeave() {
    this.isDragging = false;
  }

  /** form elementleri tabloya bırakıldığında çalışan metod */
  onDrop(event: DragEvent, row: number, col: number) {
    event.preventDefault();

    const type = event.dataTransfer?.getData('text');
    if (type) {
      const element = this.dragElements.find(e => e.type === type);
      if (element) {
        this.isTableVisible = true;
        this.isDragging = false;
        this.isButtonVisible = true;

        /** tableData içeriğini güncelle */
        const updatedTableData = [...this.tableData];
        updatedTableData[row][col] = { ...element };
        this.tableDataSubject.next(updatedTableData);

        /** eklenen element için form kontrolü oluştur */
        const controlName = `cell_${row}_${col}`;
        if (!this.form.contains(controlName)) {
          this.form.addControl(controlName, new FormControl(''));
        }

        /** Kaydedilen verileri güncelle */
        const cellData: TableCell = {
          row,
          col,
          element: { ...element },
          value: this.form.get(controlName)?.value || ''
        };

        const existingIndex = this.savedData.findIndex(d => d.row === row && d.col === col);
        if (existingIndex > -1) {
          this.savedData[existingIndex] = cellData;
        } else {
          this.savedData.push(cellData);
        }

        /** Güncellenen tabloyu kontrol et */
        this.checkTableVisibility();
      }
    }
  }

  /** API'ye veri gönderme işlemi */
  sendToApi() {
    const dataToSend = this.savedData.map(cell => ({
      row: cell.row,
      col: cell.col,
      elementType: cell.element.type,
      value: this.form.get(`cell_${cell.row}_${cell.col}`)?.value || ''
    }));

    console.log('📤 API’ye Gönderilecek Veriler:', dataToSend);
    // API çağrısı buraya eklenecek
  }

  /** Sürükleme başlatıldığında tabloyu görünür yap */
  onDragStart(event: DragEvent, type: string) {
    event.dataTransfer?.setData('text', type);
    this.isTableVisible = true;
  }

  /** Sürükleme işlemi bittiğinde tabloyu kontrol et */
  onDragEnd() {
    this.checkTableVisibility();
  }

  /** Tablonun üzerine gelindiğinde border aktif olur */
  onDragOverTable() {
    this.isDragging = true;
  }

  /** cdk sürükleme başladığında tabloyu görünür yap */
  onCdkDragStart() {
    this.isTableVisible = true;
    this.isDragging = true;
  }

  /** cdk sürükleme tamamlandığında tabloyu günceller */
  onCdkDragEnd(event: CdkDragDrop<any>) {
    console.log("onCdkDragEnd ÇALIŞTI!!!!!!!!!!!!");

    this.isDragging = false;
    const type = event.item.data?.type;

    if (type) {
      for (let row = 0; row < this.tableData.length; row++) {
        for (let col = 0; col < this.tableData[row].length; col++) {
          if (!this.tableData[row][col]) {
            this.tableData[row][col] = { type, label: type.toUpperCase() };

            const controlName = `cell_${row}_${col}`;
            if (!this.form.contains(controlName)) {
              this.form.addControl(controlName, new FormControl(''));
            }

            this.tableDataSubject.next(JSON.parse(JSON.stringify(this.tableData)));
            this.checkTableVisibility();
            return;
          }
        }
      }
    }
    this.checkTableVisibility();
  }

  /** Tablonun görünürlüğünü kontrol et ve eklendiğinde visible durumları ayarla */
  checkTableVisibility() {
    this.tableData$.pipe(delay(0)).subscribe((data) => {
      const hasElements = data.some(row => row.some(cell => cell !== null));
      this.isTableVisible = hasElements;
      this.isButtonVisible = hasElements;
    });
  }

  /** sürükle ve bırak haline getir */
  allowDrop(event: DragEvent) {
    event.preventDefault();
  }

  removeElement(row: number, col: number) {
    this.tableData[row][col] = null;

    const controlName = `cell_${row}_${col}`;
    if (this.form.contains(controlName)) {
      this.form.removeControl(controlName);
    }

    this.savedData = this.savedData.filter(d => !(d.row === row && d.col === col));
    this.checkTableVisibility();
  }
}
