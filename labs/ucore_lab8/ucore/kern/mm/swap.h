#ifndef __KERN_MM_SWAP_H__
#define __KERN_MM_SWAP_H__

#include <io.h>
#include <string.h>
#include <memlayout.h>
#include <pmm.h>
#include <mmu.h>
#include <defs.h>
#include <call.h>
#include <vmm.h>
#include <swap_fifo.h>
#include <swapfs.h>

/* *
 * swap_entry_t
 * --------------------------------------------
 * |         offset        |   reserved   | 0 |
 * --------------------------------------------
 *           24 bits            7 bits    1 bit
 * */

#define MAX_SWAP_OFFSET_LIMIT                   (1 << 24)
// the valid vaddr for check is between 0~CHECK_VALID_VADDR-1
#define CHECK_VALID_VIR_PAGE_NUM 5
#define BEING_CHECK_VALID_VADDR 0X1000
#define CHECK_VALID_VADDR (CHECK_VALID_VIR_PAGE_NUM+1)*0x1000
// the max number of valid physical page for check
#define CHECK_VALID_PHY_PAGE_NUM 4
// the max access seq number
#define MAX_SEQ_NO 10


unsigned int swap_page[CHECK_VALID_VIR_PAGE_NUM];

unsigned int swap_in_seq_no[MAX_SEQ_NO],swap_out_seq_no[MAX_SEQ_NO];

/*
 * swap_offset - takes a swap_entry (saved in pte), and returns
 * the corresponding offset in swap mem_map.
 * 
*/

struct swap_manager {
     char* name;
     /* Global initialization for the swap manager */
     void* init;
     /* Initialize the priv data inside mm_struct */
     void* init_mm;
     /* Called when tick interrupt occured */
     void* tick_event;
     /* Called when map a swappable page into the mm_struct */
     void* map_swappable;
     /* When a page is marked as shared, this routine is called to
      * delete the addr entry from the swap manager */
     void* set_unswappable;
     /* Try to swap out a page, return then victim */
     void* swap_out_victim;
     /* check the page relpacement algorithm */
     void* check_swap;
};

struct swap_manager *sm;

struct swap_manager swap_manager_fifo;

void load_swap_manager() {
     swap_manager_fifo.name            = "fifo swap manager";
     swap_manager_fifo.init            = _fifo_init;
     swap_manager_fifo.init_mm         = _fifo_init_mm;
     swap_manager_fifo.tick_event      = _fifo_tick_event;
     swap_manager_fifo.map_swappable   = _fifo_map_swappable;
     swap_manager_fifo.set_unswappable = _fifo_set_unswappable;
     swap_manager_fifo.swap_out_victim = _fifo_swap_out_victim;
     swap_manager_fifo.check_swap      = _fifo_check_swap;
}


void check_swap(void);

int
swap_init(void)
{
     int r;
     swapfs_init();
     if (!(1024 <= max_swap_offset && max_swap_offset < MAX_SWAP_OFFSET_LIMIT))
     {
          panic("bad max_swap_offset %08x.\n", max_swap_offset);
     }

     load_swap_manager();
     sm = &swap_manager_fifo;
     r = call0(sm->init);
     if (r == 0) {
          swap_init_ok = 1;
          printf("SWAP: manager = %s\n", sm->name);
          check_swap();
     }

     return r;
}

int
swap_init_mm(struct mm_struct *mm)
{
     return call1(mm, sm->init_mm);
}

int
swap_tick_event(struct mm_struct *mm)
{
     return call1(mm, sm->tick_event);
}

int
swap_map_swappable(struct mm_struct *mm, uintptr_t addr, struct Page *page, int swap_in)
{
     return call4(mm, addr, page, swap_in, sm->map_swappable);
}

int
swap_set_unswappable(struct mm_struct *mm, uintptr_t addr)
{
     return call2(mm, addr, sm->set_unswappable);
}

unsigned int swap_out_num = 0;

int
swap_out(struct mm_struct *mm, int n, int in_tick)
{
     int i;
     uintptr_t v;
     struct Page *page;
     pte_t *ptep;
     int r;

     for (i = 0; i != n; ++ i)
     {

          r = call3(mm, &page, in_tick, sm->swap_out_victim);

          if (r != 0) {
               printf("i %d, swap_out: call swap_out_victim failed\n",i);
               break;
          }

          v = page->pra_vaddr;
          ptep = get_pte(mm->pgdir, v, 0);
          assert((*ptep & PTE_P) != 0);
          if (swapfs_write( (page->pra_vaddr/PGSIZE+1)<<8, page) != 0) {
                    printf("SWAP: failed to save\n");
                    call4(mm, v, page, 0, sm->map_swappable);
                    continue;
          }
          else {
                    printf("swap_out: i %d, store page in vaddr %x to disk swap entry %d\n", i, v, page->pra_vaddr/PGSIZE+1);
                    *ptep = (page->pra_vaddr/PGSIZE+1)<<8;
                    free_page(page);
          }

          spage(1);
     }

     return i;
}

int
swap_in(struct mm_struct *mm, uintptr_t addr, struct Page **ptr_result)
{
     struct Page *result = alloc_page();
     pte_t *ptep;
     int r;

     assert(result!=NULL);
    
     ptep = get_pte(mm->pgdir, addr, 0);
     printf("SWAP: load ptep %x swap entry %d to vaddr 0x%x, page %x, No %d\n", ptep, (*ptep)>>8, addr, result, (result-pages));

     if ((r = swapfs_read((*ptep), result)) != 0)
     {
        assert(r!=0);
     }
     printf("swap_in: load disk swap entry %d with swap_page in vadr 0x%x\n", (*ptep)>>8, addr);
     *ptr_result = result;
     return 0;
}



void
check_content_set(void)
{
     *(unsigned char *)0x1000 = 0x0a;
     assert(pgfault_num==1);
     *(unsigned char *)0x1010 = 0x0a;
     assert(pgfault_num==1);
     *(unsigned char *)0x2000 = 0x0b;
     assert(pgfault_num==2);
     *(unsigned char *)0x2010 = 0x0b;
     assert(pgfault_num==2);
     *(unsigned char *)0x3000 = 0x0c;
     assert(pgfault_num==3);
     *(unsigned char *)0x3010 = 0x0c;
     assert(pgfault_num==3);
     *(unsigned char *)0x4000 = 0x0d;
     assert(pgfault_num==4);
     *(unsigned char *)0x4010 = 0x0d;
     assert(pgfault_num==4);
}

int check_content_access(void)
{
    int ret = call0(sm->check_swap);
    return ret;
}

struct Page * check_rp[CHECK_VALID_PHY_PAGE_NUM];
pte_t * check_ptep[CHECK_VALID_PHY_PAGE_NUM];
unsigned int check_swap_addr[CHECK_VALID_VIR_PAGE_NUM];


void check_swap(void)
{
    //backup mem env
     int ret, count, total, i;
     unsigned int nr_free_store;
     struct Page* p;
     struct mm_struct* mm;
     struct vma_struct* vma;
     list_entry_t* le;
     pde_t* pgdir;
     pte_t* temp_ptep;
     list_entry_t free_list_store;
     
     le = &free_list;
     count = 0;
     total = 0;
     while ((le = list_next(le)) != &free_list) {
        p = le2page(le, page_link);
        assert(PageProperty(p));
        count++;
        total += p->property;
     }
     assert(total == nr_free_pages());
     printf("BEGIN check_swap: count %d, total %d\n", count, total);

     //now we set the phy pages env
     mm = mm_create();
     assert(mm != NULL);
     assert(check_mm_struct == NULL);
     check_mm_struct = mm;

     pgdir = mm->pgdir = boot_pgdir;
     assert(pgdir[0] == 0);

     vma = vma_create(BEING_CHECK_VALID_VADDR, CHECK_VALID_VADDR, VM_WRITE | VM_READ);
     assert(vma != NULL);
     insert_vma_struct(mm, vma);

     //setup the temp Page Table vaddr 0~4MB
     printf("setup Page Table for vaddr 0X1000, so alloc a page\n");
     temp_ptep = NULL;
     temp_ptep = get_pte(mm->pgdir, BEING_CHECK_VALID_VADDR, 1);
     assert(temp_ptep!= NULL);
     printf("setup Page Table vaddr 0~4MB OVER!\n");

     for (i=0; i<CHECK_VALID_PHY_PAGE_NUM;i++) {
          check_rp[i] = alloc_page();
          assert(check_rp[i] != NULL );
          assert(!PageProperty(check_rp[i]));
     }

     memcpy(&free_list_store, &free_list, sizeof(struct list_entry));
     list_init(&free_list);
     assert(list_empty(&free_list));


     nr_free_store = nr_free;
     nr_free = 0;
     for (i=0;i<CHECK_VALID_PHY_PAGE_NUM;i++) {
        free_pages(check_rp[i], 1);
     }
     assert(nr_free==CHECK_VALID_PHY_PAGE_NUM);
     printf("set up init env for check_swap begin!\n");
     //setup initial vir_page<->phy_page environment for page relpacement algorithm

     pgfault_num=0;

     check_content_set();
     assert( nr_free == 0);
     for(i = 0; i<MAX_SEQ_NO ; i++)
         swap_out_seq_no[i]=swap_in_seq_no[i]=-1;

     for (i= 0;i<CHECK_VALID_PHY_PAGE_NUM;i++) {
         check_ptep[i] = 0;
         check_ptep[i] = get_pte(pgdir, (i+1)*0x1000, 0);
         assert(check_ptep[i] != NULL);
         assert(pte2page(*check_ptep[i]) == check_rp[i]);
         assert((*check_ptep[i] & PTE_P));
     }
     printf("set up init env for check_swap over!\n");

     // now access the virt pages to test  page relpacement algorithm
     ret = check_content_access();
     assert(ret==0);

     //restore kernel mem env
     for (i=0;i<CHECK_VALID_PHY_PAGE_NUM;i++) {
         free_pages(check_rp[i],1);
     }

     //free_page(pte2page(*temp_ptep));
     free_page(pde2page(pgdir[0]));
     pgdir[0] = 0;
     mm->pgdir = NULL;
     
     mm_destroy(mm);
     
     check_mm_struct = NULL;

     nr_free = nr_free_store;
     memcpy(&free_list, &free_list_store, sizeof(struct list_entry));

     printf("count is %d, total is %d\n",count,total);
     le = &free_list;
     while ((le = list_next(le)) != &free_list) {
         p = le2page(le, page_link);
         count --;
         total -= p->property;
     }
     printf("count is %d, total is %d\n",count,total);
     // assert(count == 0);
     printf("check_swap() succeeded!\n");
}

#endif
