const n=`---
title: "Create a Paging API in Spring Boot"
date: 2025-09-24
id: blog0417
tag: springboot
toc: true 
intro: Record the detail for how to create a paging API easily by using spring's default repository.
img: /assets/img/2025-10-05-04-35-31.png
offsety: 0
scale: 1.2
---

<style>
  video {
    border-radius: 4px;
  }
  img {
    max-width: 660px;
  }
</style>

### Returning Page<Entity> From CrudRepository<Entity>


In \`EventRepository\` I created the following signature:


\`\`\`kotlin
import dev.james.alicetimetable.commons.database.entities.Event
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.CrudRepository
import java.util.UUID

interface EventRepository : CrudRepository<Event, Int> {
    ...

    @Query("""
        select e from Event e
        order by e.createdAt desc
    """)
    fun findByPageAndLimit(pageable: Pageable): Page<Event>
}
\`\`\`


We also define a wrapper data class for consumption of frontend:
\`\`\`kotlin
data class EventsWithTotal(
    val events: List<EventDTO>,
    val total: Long
)
\`\`\`
now we combine everything to get:

\`\`\`kotlin-1{8,9}
@Service
class EventQueryApplicationService(
    private val eventRepository: EventRepository
) {
    fun getEvents(page: Int, limit: Int): EventsWithTotal {
        val pageable = PageRequest.of(page, limit)
        val eventPage = eventRepository.findByPageAndLimit(pageable)
        val result = EventsWithTotal(events = eventPage.content.map { it.toDTO() },
                                     total = eventPage.totalElements)
        return result
    }
}
\`\`\`
Here we have returned two results to frontend to accomplish pagination:

- In line 8 we return the list of ***paged elements*** to the frontend.

- In line 9 we return the ***total number*** of all matching rows to frontend so that it can show the number of pages.

### Frontend 
#### The Paging Result

<center>

[![](/assets/img/2025-09-24-01-55-43.png)](/assets/img/2025-09-24-01-55-43.png)


</center>


#### Component for Pagination
##### Implementation
In the following we use some of the elements from \`shadcn\`:
\`\`\`tsx
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';

/**
 *  There are plenty of messy logic on determining how numbers are shown, can ignore it.
 */
const CustomPagination = (props: {
    consecutivePagesBlockSize: number;
    currentPageIndex: number;
    totalPages: number;
    onPageIndexChange: (page: number) => void;
}) => {
    const { consecutivePagesBlockSize, currentPageIndex, totalPages, onPageIndexChange } = props;
    const availablePageNumbers = Array.from({ length: totalPages }, (_, i) => i);
    const lastPageIndex = totalPages - 1;
    const consecutivePagesBlockStartIndex = Math.max(currentPageIndex - 1, 0);
    const approachesTheEnd = lastPageIndex - consecutivePagesBlockStartIndex <= consecutivePagesBlockSize - 1;
    const consecutivePagesBlock = availablePageNumbers.slice(
        approachesTheEnd ? lastPageIndex - (consecutivePagesBlockSize - 1) : consecutivePagesBlockStartIndex,
        consecutivePagesBlockStartIndex + consecutivePagesBlockSize
    );

    const forceDisplayPageOne = currentPageIndex >= consecutivePagesBlockSize - 1;
    const forceDisplayLast = lastPageIndex - currentPageIndex >= consecutivePagesBlockSize - 1;
    if (totalPages <= consecutivePagesBlockSize) {
        return (
            <>
                <Pagination>
                    <PaginationContent>
                        <PaginationItem>
                            <PaginationPrevious
                                href="#"
                                onClick={() => onPageIndexChange(Math.max(currentPageIndex - 1, 0))}
                            />
                        </PaginationItem>
                        {availablePageNumbers.map(page => {
                            const isActive = page === currentPageIndex;
                            return (
                                <PaginationItem onClick={() => onPageIndexChange(page)}>
                                    <PaginationLink href="#" isActive={isActive}>
                                        {page + 1}
                                    </PaginationLink>
                                </PaginationItem>
                            );
                        })}
                        <PaginationItem>
                            <PaginationNext
                                href="#"
                                onClick={() => onPageIndexChange(Math.min(currentPageIndex + 1, totalPages - 1))}
                            />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            </>
        );
    } else {
        return (
            <>
                <Pagination>
                    <PaginationContent>
                        <PaginationItem>
                            <PaginationPrevious
                                href="#"
                                onClick={() => onPageIndexChange(Math.max(currentPageIndex - 1, 0))}
                            />
                        </PaginationItem>
                        {forceDisplayPageOne && (
                            <>
                                <PaginationItem onClick={() => onPageIndexChange(0)}>
                                    <PaginationLink href="#" isActive={currentPageIndex === 0}>
                                        1
                                    </PaginationLink>
                                </PaginationItem>
                                {currentPageIndex >= 3 && totalPages > consecutivePagesBlockSize + 1 && (
                                    <PaginationItem>
                                        <PaginationEllipsis />
                                    </PaginationItem>
                                )}
                            </>
                        )}
                        {consecutivePagesBlock.map(page => {
                            const isActive = page === currentPageIndex;
                            return (
                                <PaginationItem onClick={() => onPageIndexChange(page)}>
                                    <PaginationLink href="#" isActive={isActive}>
                                        {page + 1}
                                    </PaginationLink>
                                </PaginationItem>
                            );
                        })}
                        {lastPageIndex - currentPageIndex >= consecutivePagesBlockSize &&
                            totalPages > consecutivePagesBlockSize + 1 && (
                                <PaginationItem>
                                    <PaginationEllipsis />
                                </PaginationItem>
                            )}
                        {forceDisplayLast && (
                            <PaginationItem>
                                <PaginationLink
                                    href="#"
                                    isActive={currentPageIndex === lastPageIndex}
                                    onClick={() => onPageIndexChange(lastPageIndex)}
                                >
                                    {lastPageIndex + 1}
                                </PaginationLink>
                            </PaginationItem>
                        )}

                        <PaginationItem>
                            <PaginationNext
                                href="#"
                                onClick={() => onPageIndexChange(Math.min(currentPageIndex + 1, totalPages - 1))}
                            />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            </>
        );
    }
};

export default CustomPagination;

\`\`\`
##### Usage

In my logging page I simply define

\`\`\`tsx
export default function Logging() {
    const [page, setPage] = useState(0);
    const { data: loggings, isLoading } = 
        eventApi.endpoints.getEvents.useQuery({ page, limit: LIMIT });

    return (
            <div>
                <CustomPagination
                    consecutivePagesBlockSize={3}
                    currentPageIndex={page}
                    totalPages={Math.ceil((loggings?.total || 0) / LIMIT)}
                    onPageIndexChange={page => {
                        setPage(page);
                    }}
                />
            ...
\`\`\``;export{n as default};
