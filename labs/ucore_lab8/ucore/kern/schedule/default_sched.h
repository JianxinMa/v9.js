#ifndef __KERN_SCHEDULE_SCHED_RR_H__
#define __KERN_SCHEDULE_SCHED_RR_H__

#include <defs.h>
#include <list.h>
#include <pstruct.h>
#include <schstruct.h>

#define USE_SKEW_HEAP 1
/* You should define the BigStride constant here*/
/* LAB6: 2013011343 */
#define BIG_STRIDE    0x7FFFFFFF /* ??? */
/* The compare function for two skew_heap_node_t's and the
 * corresponding procs*/
int
proc_stride_comp_f(void *a, void *b)
{
     struct proc_struct *p = le2proc(a, lab6_run_pool);
     struct proc_struct *q = le2proc(b, lab6_run_pool);
     int32_t c = p->lab6_stride - q->lab6_stride;
     if (c > 0) return 1;
     else if (c == 0) return 0;
     else return -1;
}

/*
 * stride_init initializes the run-queue rq with correct assignment for
 * member variables, including:
 *
 *   - run_list: should be a empty list after initialization.
 *   - lab6_run_pool: NULL
 *   - proc_num: 0
 *   - max_time_slice: no need here, the variable would be assigned by the caller.
 *
 * hint: see proj13.1/libs/list.h for routines of the list structures.
 */
void
stride_init(struct run_queue *rq) {
     /* LAB6: 2013011343 */
     list_init(&(rq->run_list));
     rq->lab6_run_pool = NULL;
     rq->proc_num = 0;
}

/*
 * stride_enqueue inserts the process ``proc'' into the run-queue
 * ``rq''. The procedure should verify/initialize the relevant members
 * of ``proc'', and then put the ``lab6_run_pool'' node into the
 * queue(since we use priority queue here). The procedure should also
 * update the meta date in ``rq'' structure.
 *
 * proc->time_slice denotes the time slices allocation for the
 * process, which should set to rq->max_time_slice.
 *
 * hint: see proj13.1/libs/skew_heap.h for routines of the priority
 * queue structures.
 */
void
stride_enqueue(struct run_queue *rq, struct proc_struct *proc) {
     /* LAB6: 2013011343 */
     rq->lab6_run_pool =
          skew_heap_insert(rq->lab6_run_pool, &(proc->lab6_run_pool), proc_stride_comp_f);
     if (proc->time_slice == 0 || proc->time_slice > rq->max_time_slice) {
          proc->time_slice = rq->max_time_slice;
     }
     proc->rq = rq;
     rq->proc_num ++;
}

/*
 * stride_dequeue removes the process ``proc'' from the run-queue
 * ``rq'', the operation would be finished by the skew_heap_remove
 * operations. Remember to update the ``rq'' structure.
 *
 * hint: see proj13.1/libs/skew_heap.h for routines of the priority
 * queue structures.
 */
void
stride_dequeue(struct run_queue *rq, struct proc_struct *proc) {
     /* LAB6: 2013011343 */
     rq->lab6_run_pool =
          skew_heap_remove(rq->lab6_run_pool, &(proc->lab6_run_pool), proc_stride_comp_f);
     rq->proc_num --;
}
/*
 * stride_pick_next pick the element from the ``run-queue'', with the
 * minimum value of stride, and returns the corresponding process
 * pointer. The process pointer would be calculated by macro le2proc,
 * see proj13.1/kern/process/proc.h for definition. Return NULL if
 * there is no process in the queue.
 *
 * When one proc structure is selected, remember to update the stride
 * property of the proc. (stride += BIG_STRIDE / priority)
 *
 * hint: see proj13.1/libs/skew_heap.h for routines of the priority
 * queue structures.
 */
struct proc_struct *
stride_pick_next(struct run_queue *rq) {
     /* LAB6: 2013011343 */
     struct proc_struct *p;
     if (rq->lab6_run_pool == NULL) return NULL;
     p = le2proc(rq->lab6_run_pool, lab6_run_pool);
     if (p->lab6_priority == 0)
          p->lab6_stride += BIG_STRIDE;
     else p->lab6_stride += BIG_STRIDE / p->lab6_priority;
     return p;
}

/*
 * stride_proc_tick works with the tick event of current process. You
 * should check whether the time slices for current process is
 * exhausted and update the proc struct ``proc''. proc->time_slice
 * denotes the time slices left for current
 * process. proc->need_resched is the flag variable for process
 * switching.
 */
void
stride_proc_tick(struct run_queue *rq, struct proc_struct *proc) {
     /* LAB6: 2013011343 */
     if (proc->time_slice > 0)
          proc->time_slice --;
     if (proc->time_slice == 0)
          proc->need_resched = 1;
}

struct sched_class default_sched_class;

void load_default_sched_class() {
  	default_sched_class.name = "stride_scheduler";
    default_sched_class.init = stride_init;
    default_sched_class.enqueue = stride_enqueue;
    default_sched_class.dequeue = stride_dequeue;
    default_sched_class.pick_next = stride_pick_next;
    default_sched_class.proc_tick = stride_proc_tick;
}

#endif /* !__KERN_SCHEDULE_SCHED_RR_H__ */

