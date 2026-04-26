#ifndef _LINUX_BUDDY_H
#define _LINUX_BUDDY_H

#include <stdbool.h>

#define MAX_ORDER  5
#define MAX_PAGE_NUM 16

#define PG_buddy     0x00000080
#define PAGE_TYPE_BASE	0xf0000000
#define PG_report     0x00000001

struct process {
  char pid;
  unsigned long private;
};

struct page
{
  unsigned int page_type;
  unsigned long private;
  struct list_head lru;
  struct process process;
};

#define PageType(page, flag)						\
	((page->page_type & (PAGE_TYPE_BASE | flag)) == PAGE_TYPE_BASE)

#define PAGE_TYPE_OPS(uname, lname)					\
static __always_inline int Page##uname(struct page *page)		\
{									\
	return PageType(page, PG_##lname);				\
}									\
static __always_inline void __SetPage##uname(struct page *page)		\
{									\
	page->page_type &= ~PG_##lname;					\
}									\
static __always_inline void __ClearPage##uname(struct page *page)	\
{									\
	page->page_type |= PG_##lname;					\
}

PAGE_TYPE_OPS(Buddy, buddy)
PAGE_TYPE_OPS(Report, report)


struct free_area
{
  struct list_head free_list;
  unsigned long nr_free;
};

struct page pages[MAX_PAGE_NUM];
struct free_area free_area[MAX_ORDER];

struct page *alloc_pages (unsigned int order);
void free_pages (struct page *page, unsigned int order);

#endif
